import "server-only";

import { prisma } from "@/lib/prisma";
import {
  absoluteJalaliMonth,
  fromAbsoluteJalaliMonth,
  fromJalaliDate,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
  toJalaliDate,
} from "@/utils/date";
import { sumRial } from "@/utils/money";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { getUpcomingObligations } from "@/features/calendar/server/calendar-service";
import { occurrencesForWindow } from "@/features/recurring/server/recurring-service";
import {
  expectedIncome,
  firstShortfall,
  forecast,
  isLiquid,
  liquidityWarning,
  type ForecastMonthInput,
  type ForecastPeriod,
} from "@/features/forecast/forecast";
import type { ForecastDto, ForecastPointDto } from "@/features/forecast/types";

/**
 * Cash-flow forecasting (tasks 6.6–6.9).
 *
 * The arithmetic is in `forecast.ts` and has no database; this file gathers
 * what it needs.
 *
 * What the roadmap asks the forecast to consider:
 *
 *   current balances + expected income − loans − recurring − budgets
 *
 * Two of those need care, and both are handled here rather than in the
 * arithmetic, because both are about what the figures *mean* rather than how
 * they add up:
 *
 * **Income is an estimate.** Nothing in the ledger says what next month will
 * bring, so it is the median of what the household actually earned — see
 * `expectedIncome` for why the median and not the mean.
 *
 * **Budgets and recurring payments overlap.** The rent is a recurring
 * payment *and* falls under a budgeted housing category. Adding both would
 * charge the household for it twice, so each budget is reduced by the
 * recurring payments filed under it before anything is summed.
 */

/** How many months of history the income estimate is taken from. */
const INCOME_HISTORY_MONTHS = 6;

/** How far ahead the near-term warning looks (task 6.9). */
const WARNING_DAYS = 7;

/** A bound on the obligations the near-term warning looks at. */
const OBLIGATION_LIMIT = 200;

const DAY = 86_400_000;

export async function getForecast(
  period: ForecastPeriod = 3,
  now: Date = new Date(),
): Promise<ForecastDto> {
  const firstMonth = absoluteJalaliMonth(jalaliMonthOf(now));
  const months = Array.from({ length: period }, (_, index) => firstMonth + index);
  const horizon = jalaliMonthRange(fromAbsoluteJalaliMonth(months.at(-1)!)).end;

  const [accounts, incomeHistory, loanPayments, recurring, budgets, categories, soFar] =
    await Promise.all([
      listAccounts(accountFiltersSchema.parse({})),
      monthlyIncome(firstMonth),
      loanPaymentsByMonth(now, horizon),
      recurringByMonth(now, horizon),
      // Every budget window, so the one in force for each projected month can
      // be picked out without a query per month.
      prisma.budget.findMany({ orderBy: { fromMonth: "asc" } }),
      prisma.category.findMany({
        where: { kind: "EXPENSE" },
        select: { id: true, parentId: true },
      }),
      // What the month in progress has already done. See `thisMonthSoFar`.
      thisMonthSoFar(firstMonth),
    ]);

  // Only what could actually be spent: an investment account would have to be
  // liquidated first, and a business account is not the household's to spend.
  const openingBalance = sumRial(
    accounts
      .filter((account) => account.isActive && isLiquid(account.type))
      .map((account) => BigInt(account.balance)),
  );

  const income = expectedIncome(incomeHistory);
  const childrenOf = groupChildren(categories);

  const inputs: ForecastMonthInput[] = months.map((month) => {
    // The month in progress is counted as what is *left* of it. Its income
    // and its spending so far are already sitting in the opening balance, so
    // adding a whole month of either on top would count them twice — which
    // drew a forecast climbing steeply through a month that was nearly over.
    // Every later month has nothing spent or received yet, so these fall away
    // to zero on their own.
    const current = month === firstMonth;
    const receivedAlready = current ? soFar.income : 0n;

    return {
      month,
      income: subtractToZero(income, receivedAlready),
      loanPayments: loanPayments.get(month) ?? 0n,
      recurringExpenses: sumRial([...(recurring.get(month)?.values() ?? [])]),
      budgetedExpenses: budgetedBeyondRecurring(
        budgets,
        month,
        recurring.get(month) ?? new Map(),
        childrenOf,
        current ? soFar.spendingByCategory : new Map(),
      ),
    };
  });

  const points = forecast(openingBalance, inputs);
  const shortfall = firstShortfall(points);

  return {
    period,
    openingBalance: openingBalance.toString(),
    expectedIncome: income.toString(),
    incomeMonths: incomeHistory.length,
    points: points.map(toPointDto),
    shortfallMonth: shortfall?.month ?? null,
    warning: await nearTermWarning(openingBalance, now),
  };
}

function toPointDto(point: ReturnType<typeof forecast>[number]): ForecastPointDto {
  const { year, month } = fromAbsoluteJalaliMonth(point.month);

  return {
    month: point.month,
    label: jalaliMonthLabel({ year, month }, { withYear: false }),
    openingBalance: point.openingBalance.toString(),
    income: point.income.toString(),
    loanPayments: point.loanPayments.toString(),
    recurringExpenses: point.recurringExpenses.toString(),
    budgetedExpenses: point.budgetedExpenses.toString(),
    outflow: point.outflow.toString(),
    net: point.net.toString(),
    closingBalance: point.closingBalance.toString(),
    isShortfall: point.isShortfall,
  };
}

/* -------------------------------------------------------------------------
 * Gathering
 * ---------------------------------------------------------------------- */

/**
 * What the household earned in each of the months before this one.
 *
 * The current month is excluded: it is part-finished, and a forecast run on
 * the third of Mehr would otherwise take three days of income as a month's
 * worth and project the household into poverty.
 *
 * One query rather than one per month, bucketed here because the month is
 * Jalali and the column is a UTC instant — Postgres has no Persian calendar.
 */
async function monthlyIncome(currentMonth: number): Promise<bigint[]> {
  const from = currentMonth - INCOME_HISTORY_MONTHS;
  const start = jalaliMonthRange(fromAbsoluteJalaliMonth(from)).start;
  const end = jalaliMonthRange(fromAbsoluteJalaliMonth(currentMonth)).start;

  const rows = await prisma.transaction.findMany({
    where: { type: "INCOME", date: { gte: start, lt: end } },
    select: { date: true, amount: true },
  });

  const totals = new Map<number, bigint>();

  for (let month = from; month < currentMonth; month += 1) totals.set(month, 0n);

  for (const row of rows) {
    const month = absoluteJalaliMonth(jalaliMonthOf(row.date));
    totals.set(month, (totals.get(month) ?? 0n) + row.amount);
  }

  // Months before the household started recording are not lean months; they
  // are no data, and including them as zeroes would drag the median to zero.
  return [...totals.values()].filter((total) => total > 0n);
}

/** Unpaid instalments falling due in each Jalali month of the horizon. */
async function loanPaymentsByMonth(
  now: Date,
  horizon: Date,
): Promise<Map<number, bigint>> {
  const rows = await prisma.installment.findMany({
    where: {
      paidAt: null,
      dueDate: { gte: now, lt: horizon },
      loan: { status: { not: "ARCHIVED" } },
    },
    select: { dueDate: true, amount: true },
  });

  const totals = new Map<number, bigint>();

  for (const row of rows) {
    const month = absoluteJalaliMonth(jalaliMonthOf(row.dueDate));
    totals.set(month, (totals.get(month) ?? 0n) + row.amount);
  }

  return totals;
}

/**
 * Unpaid recurring occurrences per month, kept **by category**.
 *
 * The category is what makes the budget netting possible: without it there
 * would be no way to tell which budget a projected rent payment already sits
 * inside.
 */
async function recurringByMonth(
  now: Date,
  horizon: Date,
): Promise<Map<number, Map<string, bigint>>> {
  const occurrences = await occurrencesForWindow({ start: now, end: horizon }, now);
  const ids = [...new Set(occurrences.map((entry) => entry.recurringPaymentId))];

  const payments = await prisma.recurringPayment.findMany({
    where: { id: { in: ids } },
    select: { id: true, categoryId: true },
  });

  const categoryOf = new Map(payments.map((row) => [row.id, row.categoryId]));
  const totals = new Map<number, Map<string, bigint>>();

  for (const occurrence of occurrences) {
    if (occurrence.status === "PAID") continue;

    const month = absoluteJalaliMonth(jalaliMonthOf(new Date(occurrence.dueDate)));
    // A rule with no category still costs money; it just cannot be netted
    // against any budget, so it gets a bucket of its own.
    const key = categoryOf.get(occurrence.recurringPaymentId) ?? `__uncategorised__`;

    const byCategory = totals.get(month) ?? new Map<string, bigint>();
    byCategory.set(key, (byCategory.get(key) ?? 0n) + BigInt(occurrence.amount));
    totals.set(month, byCategory);
  }

  return totals;
}

/**
 * Budgeted spending beyond what the recurring payments already cover.
 *
 * For each budget in force that month, the recurring payments filed under
 * that category or its children are subtracted, floored at zero. What is
 * left is the discretionary part — the groceries inside a food budget that
 * no rule predicts.
 *
 * Only budgets with no budgeted ancestor are counted, for the same reason
 * the budgets screen's own total works that way: a child's spending already
 * sits inside its parent's limit.
 */
function budgetedBeyondRecurring(
  budgets: {
    categoryId: string;
    amount: bigint;
    fromMonth: number;
    toMonth: number | null;
  }[],
  month: number,
  recurringByCategory: Map<string, bigint>,
  childrenOf: Map<string, string[]>,
  /** Already spent this month, for the month in progress. Empty otherwise. */
  spentByCategory: Map<string, bigint>,
): bigint {
  const inForce = budgets.filter(
    (budget) =>
      budget.fromMonth <= month && (budget.toMonth === null || month <= budget.toMonth),
  );

  const budgetedIds = new Set(inForce.map((budget) => budget.categoryId));

  const parentOf = new Map<string, string>();
  for (const [parent, children] of childrenOf) {
    for (const child of children) parentOf.set(child, parent);
  }

  return sumRial(
    inForce
      .filter((budget) => {
        const parent = parentOf.get(budget.categoryId);
        return parent === undefined || !budgetedIds.has(parent);
      })
      .map((budget) => {
        const ids = [budget.categoryId, ...(childrenOf.get(budget.categoryId) ?? [])];
        // Recurring payments still ahead, plus whatever the month has
        // already spent. The two cannot overlap: a recurring payment that
        // has been paid is no longer an unpaid occurrence, and shows up in
        // the spending instead.
        const covered =
          sumRial(ids.map((id) => recurringByCategory.get(id) ?? 0n)) +
          sumRial(ids.map((id) => spentByCategory.get(id) ?? 0n));

        return subtractToZero(budget.amount, covered);
      }),
  );
}

/** `a - b`, floored at zero: an over-spent budget is not a credit. */
function subtractToZero(a: bigint, b: bigint): bigint {
  return a > b ? a - b : 0n;
}

/**
 * What the month in progress has already earned and spent.
 *
 * Both are already reflected in the opening balance, so the projection has
 * to leave them out of that month or count them twice. A forecast run on the
 * last day of Shahrivar was adding a whole month's salary and a whole
 * month's budget to a balance that already contained both.
 */
async function thisMonthSoFar(month: number): Promise<{
  income: bigint;
  spendingByCategory: Map<string, bigint>;
}> {
  const { start, end } = jalaliMonthRange(fromAbsoluteJalaliMonth(month));

  const rows = await prisma.transaction.findMany({
    // Transfers are not spending (rule G.3) and are excluded by the type
    // filter, not by hoping none exist.
    where: { type: { in: ["INCOME", "EXPENSE"] }, date: { gte: start, lt: end } },
    select: { type: true, amount: true, categoryId: true },
  });

  let income = 0n;
  const spendingByCategory = new Map<string, bigint>();

  for (const row of rows) {
    if (row.type === "INCOME") {
      income += row.amount;
      continue;
    }

    if (!row.categoryId) continue;

    spendingByCategory.set(
      row.categoryId,
      (spendingByCategory.get(row.categoryId) ?? 0n) + row.amount,
    );
  }

  return { income, spendingByCategory };
}

/** Direct children by parent id. The category tree is two levels deep. */
function groupChildren(
  categories: { id: string; parentId: string | null }[],
): Map<string, string[]> {
  const children = new Map<string, string[]>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const list = children.get(category.parentId);
    if (list) list.push(category.id);
    else children.set(category.parentId, [category.id]);
  }

  return children;
}

/**
 * Whether the week ahead is covered (task 6.9).
 *
 * Deliberately measured against real dated obligations rather than a slice
 * of the monthly forecast. A month that closes comfortably can still have a
 * week in the middle where the rent, an instalment and a bill all land
 * before payday, and that week is what this is for.
 */
async function nearTermWarning(availableBalance: bigint, now: Date) {
  const until = new Date(now.getTime() + WARNING_DAYS * DAY);

  // Obligations come back in date order, so the ones inside a week are
  // always within the first few; the limit is a safety bound, not a page.
  const obligations = await getUpcomingObligations(OBLIGATION_LIMIT, now);

  const due = sumRial(
    obligations
      .filter((event) => {
        const date = new Date(event.date);
        return date >= startOfDay(now) && date < until;
      })
      .map((event) => BigInt(event.amount)),
  );

  return liquidityWarning(availableBalance, due, WARNING_DAYS);
}

/**
 * Midnight **Tehran** of today, as the UTC instant the database stores.
 *
 * Obligations are stored at the midnight of their Jalali day; comparing
 * against the current instant would drop everything due today the moment the
 * clock passed midnight, which is exactly the payment the household most
 * needs warning of. Subtracting the remainder of a UTC day would be wrong by
 * the Tehran offset, so the conversion goes through the calendar.
 */
function startOfDay(now: Date): Date {
  return fromJalaliDate(toJalaliDate(now));
}
