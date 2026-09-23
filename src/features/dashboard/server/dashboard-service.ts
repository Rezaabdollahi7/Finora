import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assetValueAsOf, assetValuesAt } from "@/features/assets/server/asset-service";
import { getUpcomingObligations } from "@/features/calendar/server/calendar-service";
import {
  addJalaliMonths,
  formatJalaliDate,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
  recentJalaliMonths,
  toJalaliDate,
  type JalaliMonth,
} from "@/utils/date";
import type {
  AccountShare,
  BudgetStatus,
  CashFlowPoint,
  CategoryExpense,
  DashboardSummary,
  DashboardTotals,
  NetWorthPoint,
  NetWorthRange,
  UpcomingPayment,
} from "@/features/dashboard/types";

/**
 * Dashboard aggregation (task 2.1).
 *
 * Everything here is computed by the database — SUM and GROUP BY, never a
 * findMany followed by arithmetic in JavaScript. That is what task 2.10 asks
 * for, and it is also the only way the totals stay exact, since Prisma
 * returns BigInt for a BigInt column while a JavaScript reduce over a large
 * ledger would be tempted through Number.
 *
 * Periods are Jalali months. A Persian household's "this month" is Shahrivar,
 * not September, and reporting on Gregorian months would split every month
 * across two rows.
 */

/* -------------------------------------------------------------------------
 * Not yet modelled
 *
 * Budgets arrive in Sprint 5. The dashboard's shape is complete; this is the
 * only place that changes when they land, and the figures above it are
 * already correct arithmetic over whatever it returns.
 *
 * Assets landed in Sprint 3 and loans in Sprint 4; both now come from their
 * own services.
 * ---------------------------------------------------------------------- */

/**
 * What the household still owes on its loans at an instant (task 3.9).
 *
 * The unpaid instalments, not the outstanding principal: the household's
 * liability is the money that will actually leave its accounts, interest
 * included. That is the same figure the loans page calls "مانده بدهی", so
 * net worth and the loan list cannot disagree.
 *
 * Instalments due *after* the instant are what is still owed at it. A
 * payment recorded later does not make a past liability smaller, which is
 * what keeps the net-worth history honest (rule G.4).
 */
async function loadLiabilityValue(asOf: Date): Promise<bigint> {
  const owed = await prisma.installment.aggregate({
    where: {
      loan: { status: { not: "ARCHIVED" } },
      OR: [{ paidAt: null }, { paidAt: { gte: asOf } }],
    },
    _sum: { amount: true },
  });

  return owed._sum.amount ?? 0n;
}

/** Obligations still owed, soonest first (task 4.9). */
async function loadUpcomingPayments(
  after: Date,
  limit: number,
): Promise<UpcomingPayment[]> {
  const events = await getUpcomingObligations(limit, after);

  return events.map((event) => ({
    id: event.id,
    title: event.subtitle ? `${event.title} — ${event.subtitle}` : event.title,
    amount: event.amount,
    dueDate: event.date,
    kind: event.kind === "LOAN_INSTALLMENT" ? "LOAN_INSTALLMENT" : "RECURRING",
  }));
}

/** Budget versus actual for a period. Sprint 5. */
async function loadBudgetStatus(period: {
  start: Date;
  end: Date;
}): Promise<BudgetStatus[]> {
  void period;
  return [];
}

/* -------------------------------------------------------------------------
 * Balances
 * ---------------------------------------------------------------------- */

/**
 * The household's liquid balance at an instant.
 *
 * Counts active accounts only: an archived account is out of play, and
 * including it would overstate what is actually spendable.
 *
 * `asOf` makes the figure a point in time rather than "now", which is what
 * the previous-month comparison needs — the balance as it stood at the end of
 * last month, not today's balance.
 */
export async function totalBalanceAsOf(asOf: Date): Promise<bigint> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, initialBalance: true },
  });

  if (accounts.length === 0) return 0n;

  const ids = accounts.map((account) => account.id);
  let total = accounts.reduce((sum, account) => sum + account.initialBalance, 0n);

  const dated: Prisma.TransactionWhereInput = { date: { lt: asOf } };

  const [outgoing, incoming] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { ...dated, accountId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...dated, type: "TRANSFER", toAccountId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);

  for (const row of outgoing) {
    const amount = row._sum.amount ?? 0n;
    total += row.type === "INCOME" ? amount : -amount;
  }

  return total + (incoming._sum.amount ?? 0n);
}

/* -------------------------------------------------------------------------
 * Period totals
 * ---------------------------------------------------------------------- */

/**
 * Income and expenses within a half-open period.
 *
 * Transfers are excluded by construction: only INCOME and EXPENSE rows are
 * summed, so moving money between household accounts can never register as
 * either (rule G.3).
 */
async function incomeAndExpenses(period: { start: Date; end: Date }) {
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      type: { in: ["INCOME", "EXPENSE"] },
      date: { gte: period.start, lt: period.end },
    },
    _sum: { amount: true },
  });

  const find = (type: "INCOME" | "EXPENSE") =>
    rows.find((row) => row.type === type)?._sum.amount ?? 0n;

  return { income: find("INCOME"), expenses: find("EXPENSE") };
}

async function totalsFor(month: JalaliMonth): Promise<DashboardTotals> {
  const period = jalaliMonthRange(month);

  const [{ income, expenses }, balance, assets, liabilities] = await Promise.all([
    incomeAndExpenses(period),
    // Balances and holdings are measured at the end of the period, so "last
    // month" means where the household stood when that month closed.
    totalBalanceAsOf(period.end),
    assetValueAsOf(period.end),
    loadLiabilityValue(period.end),
  ]);

  return {
    totalBalance: balance.toString(),
    monthlyIncome: income.toString(),
    monthlyExpenses: expenses.toString(),
    monthlySavings: (income - expenses).toString(),
    assetValue: assets.toString(),
    liabilityValue: liabilities.toString(),
    /*
     * Net worth = assets + account balances − liabilities (task 3.9).
     *
     * Nothing is counted twice, and that is structural rather than a rule
     * someone has to remember: AssetType has no cash or bank member, so
     * money in an account cannot also be registered as an asset. Foreign
     * currency is an asset precisely because the ledger is Rial-only, so it
     * has nowhere else to live.
     */
    netWorth: (assets + balance - liabilities).toString(),
  };
}

/** Every figure the dashboard needs, for a month and the one before it. */
export async function getDashboardSummary(
  month: JalaliMonth = jalaliMonthOf(new Date()),
): Promise<DashboardSummary> {
  const period = jalaliMonthRange(month);
  const previousMonth = addJalaliMonths(month, -1);

  const [current, previous, upcomingPayments, budgets] = await Promise.all([
    totalsFor(month),
    totalsFor(previousMonth),
    // Twelve rather than five: a household with nine overdue instalments
    // would otherwise see nothing but arrears, and the widget's whole point
    // is the horizons — what is owed today, this week, this month.
    loadUpcomingPayments(new Date(), 12),
    loadBudgetStatus(period),
  ]);

  return {
    period: {
      ...month,
      label: jalaliMonthLabel(month),
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    current,
    previous,
    upcomingPayments,
    budgets,
  };
}

/* -------------------------------------------------------------------------
 * Charts
 * ---------------------------------------------------------------------- */

/**
 * Income, expenses and savings per Jalali month, oldest first (task 2.3).
 *
 * One grouped query covering the whole span rather than one per month, so
 * the chart costs the same whether it shows six months or twenty-four.
 */
export async function getCashFlow(
  months = 6,
  end: JalaliMonth = jalaliMonthOf(new Date()),
): Promise<CashFlowPoint[]> {
  const window = recentJalaliMonths(end, months);
  const ranges = window.map((month) => ({ month, ...jalaliMonthRange(month) }));
  const first = ranges[0];
  const last = ranges[ranges.length - 1];

  if (!first || !last) return [];

  const rows = await prisma.transaction.findMany({
    where: {
      type: { in: ["INCOME", "EXPENSE"] },
      date: { gte: first.start, lt: last.end },
    },
    select: { type: true, amount: true, date: true },
  });

  // Bucketing happens here rather than in SQL because the month boundaries
  // are Jalali, which PostgreSQL cannot express. The query is still bounded
  // to the window, and only two columns are read.
  const buckets = new Map<string, { income: bigint; expenses: bigint }>();
  const key = (month: JalaliMonth) => `${month.year}-${month.month}`;

  for (const range of ranges)
    buckets.set(key(range.month), { income: 0n, expenses: 0n });

  for (const row of rows) {
    const range = ranges.find(
      (candidate) => row.date >= candidate.start && row.date < candidate.end,
    );
    if (!range) continue;

    const bucket = buckets.get(key(range.month));
    if (!bucket) continue;

    if (row.type === "INCOME") bucket.income += row.amount;
    else bucket.expenses += row.amount;
  }

  return window.map((month) => {
    const bucket = buckets.get(key(month)) ?? { income: 0n, expenses: 0n };

    return {
      year: month.year,
      month: month.month,
      label: jalaliMonthLabel(month, { withYear: false }),
      income: bucket.income.toString(),
      expenses: bucket.expenses.toString(),
      savings: (bucket.income - bucket.expenses).toString(),
    };
  });
}

/**
 * Expense distribution for a month, by top-level category (task 2.4).
 *
 * Subcategory spending rolls up into its parent: a chart with "Groceries",
 * "Restaurant" and "Fast food" as separate slices hides that food is the
 * household's largest outgoing. Uncategorised expenses get their own slice
 * rather than being dropped, so the shares always add up to the month's
 * total.
 */
export async function getExpensesByCategory(
  month: JalaliMonth = jalaliMonthOf(new Date()),
): Promise<CategoryExpense[]> {
  const period = jalaliMonthRange(month);

  const rows = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { type: "EXPENSE", date: { gte: period.start, lt: period.end } },
    _sum: { amount: true },
  });

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.categoryId).filter((id) => id !== null);
  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, icon: true, parentId: true },
  });

  const parentIds = categories.map((c) => c.parentId).filter((id) => id !== null);
  const parents = await prisma.category.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, name: true, icon: true },
  });

  const byId = new Map(categories.map((category) => [category.id, category]));
  const parentById = new Map(parents.map((parent) => [parent.id, parent]));

  const totals = new Map<string, CategoryExpense>();
  let grandTotal = 0n;

  for (const row of rows) {
    const amount = row._sum.amount ?? 0n;
    grandTotal += amount;

    const category = row.categoryId ? byId.get(row.categoryId) : undefined;
    const parent = category?.parentId ? parentById.get(category.parentId) : undefined;
    const bucket = parent ?? category;

    const id = bucket?.id ?? "__uncategorised__";
    const existing = totals.get(id);

    if (existing) {
      existing.amount = (BigInt(existing.amount) + amount).toString();
      continue;
    }

    totals.set(id, {
      categoryId: bucket?.id ?? null,
      name: bucket?.name ?? "بدون دسته",
      icon: bucket?.icon ?? null,
      amount: amount.toString(),
      share: 0,
    });
  }

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      // Shares are a display concern, so a float is fine here — the amount
      // beside it stays exact.
      share: grandTotal === 0n ? 0 : Number(entry.amount) / Number(grandTotal),
    }))
    .sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1));
}

/* -------------------------------------------------------------------------
 * Account distribution (task 2.5)
 * ---------------------------------------------------------------------- */

/**
 * Where the household's liquid money currently sits.
 *
 * Active accounts only, largest first. Shares are taken against the sum of
 * the *positive* balances rather than the net total: an overdrawn account
 * would otherwise shrink the denominator and push every other share above
 * 100%. An account in the red keeps its real balance and a share of zero,
 * which is the honest reading — it holds none of the money.
 */
export async function getAccountDistribution(): Promise<AccountShare[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true, owner: true, initialBalance: true },
  });

  if (accounts.length === 0) return [];

  const activity = await accountDeltas(accounts.map((account) => account.id));

  const balances = accounts.map((account) => ({
    accountId: account.id,
    name: account.name,
    type: account.type as string,
    owner: account.owner as string,
    balance: account.initialBalance + (activity.get(account.id) ?? 0n),
  }));

  const positiveTotal = balances.reduce(
    (sum, entry) => (entry.balance > 0n ? sum + entry.balance : sum),
    0n,
  );

  return balances
    .map((entry) => ({
      accountId: entry.accountId,
      name: entry.name,
      type: entry.type,
      owner: entry.owner,
      balance: entry.balance.toString(),
      share:
        positiveTotal === 0n || entry.balance <= 0n
          ? 0
          : Number(entry.balance) / Number(positiveTotal),
    }))
    .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
}

/** Net movement per account, in two grouped queries. */
async function accountDeltas(ids: readonly string[]): Promise<Map<string, bigint>> {
  const deltas = new Map<string, bigint>();
  if (ids.length === 0) return deltas;

  const add = (id: string, amount: bigint) =>
    deltas.set(id, (deltas.get(id) ?? 0n) + amount);

  const [outgoing, incoming] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      where: { accountId: { in: [...ids] } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["toAccountId"],
      where: { type: "TRANSFER", toAccountId: { in: [...ids] } },
      _sum: { amount: true },
    }),
  ]);

  for (const row of outgoing) {
    const amount = row._sum.amount ?? 0n;
    add(row.accountId, row.type === "INCOME" ? amount : -amount);
  }

  for (const row of incoming) {
    if (row.toAccountId) add(row.toAccountId, row._sum.amount ?? 0n);
  }

  return deltas;
}

/* -------------------------------------------------------------------------
 * Net worth history (task 2.6)
 * ---------------------------------------------------------------------- */

/** Where a range's points fall, and what to call them. */
function netWorthPointTimes(
  range: NetWorthRange,
  now: Date,
  earliest: Date | null,
): { at: Date; label: string }[] {
  if (range === "MONTH") {
    // Within a single month, monthly points would be one dot. Step through
    // the month a few days at a time instead, ending at now.
    const { start } = jalaliMonthRange(jalaliMonthOf(now));
    const times: Date[] = [];

    for (let at = start.getTime(); at < now.getTime(); at += 5 * 86_400_000) {
      times.push(new Date(at));
    }
    times.push(now);

    return times.map((at) => ({
      at,
      label: formatJalaliDate(at, { style: "medium" }),
    }));
  }

  const current = jalaliMonthOf(now);
  const months =
    range === "M3"
      ? 3
      : range === "M6"
        ? 6
        : range === "YEAR"
          ? 12
          : allTimeMonthCount(earliest, current);

  return recentJalaliMonths(current, months).map((month, index, all) => ({
    // Each month is measured at its close, except the current one, which is
    // measured now — its month has not finished yet.
    at: index === all.length - 1 ? now : jalaliMonthRange(month).end,
    label: jalaliMonthLabel(month, { withYear: false }),
  }));
}

/**
 * How many months "all time" spans.
 *
 * Capped, because a chart cannot usefully draw two hundred points and the
 * query window grows with it. Past the cap the range behaves as the longest
 * one that stays readable.
 */
const ALL_TIME_MAX_MONTHS = 36;

function allTimeMonthCount(earliest: Date | null, current: JalaliMonth): number {
  if (!earliest) return 1;

  const first = toJalaliDate(earliest);
  const span = (current.year - first.year) * 12 + (current.month - first.month) + 1;

  return Math.min(Math.max(span, 1), ALL_TIME_MAX_MONTHS);
}

/**
 * Net worth at a series of instants (tasks 2.6 and 3.10).
 *
 * The history is derived, not snapshotted. A stored snapshot would be a
 * second source of truth that goes stale the moment a transaction is
 * back-dated or a forgotten price is filled in, and reconciling it is a
 * class of bug this application cannot afford — the same reasoning that
 * keeps Account without a balance column. Deriving it is safe precisely
 * because the inputs are themselves historical: transactions carry the date
 * the money moved, and a valuation is a fact about one instant that later
 * re-pricings never touch (task 3.8). Re-running this for last Farvardin
 * gives what last Farvardin gave.
 *
 * Three queries regardless of how many points are asked for: the accounts'
 * opening position, the transactions inside the window, and every valuation
 * of every held asset. The running totals are carried forward point by
 * point, so twelve months costs what three costs.
 *
 * Bucketing happens here rather than in SQL for the same reason as the
 * cash-flow chart: the boundaries are Jalali, which PostgreSQL cannot
 * express. Only a few columns are read and the window is bounded.
 */
export async function getNetWorthHistory(
  range: NetWorthRange = "M6",
  now: Date = new Date(),
): Promise<NetWorthPoint[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, initialBalance: true },
  });

  // Assets alone are still a net worth worth drawing: a household can own a
  // flat before it opens an account here.
  if (accounts.length === 0) return netWorthFromAssetsAlone(range, now);

  const ids = new Set(accounts.map((account) => account.id));
  const opening = accounts.reduce((sum, account) => sum + account.initialBalance, 0n);

  // "All time" means the whole history the household has, which starts at
  // whichever came first: the earliest movement of money, or the earliest
  // thing it owned. Taking only the transaction would cut the line off after
  // a flat bought years before the first transaction was recorded here.
  const earliest = range === "ALL" ? await earliestRecord([...ids]) : null;

  const points = netWorthPointTimes(range, now, earliest);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return [];

  const rows = await prisma.transaction.findMany({
    where: {
      date: { lte: last.at },
      OR: [{ accountId: { in: [...ids] } }, { toAccountId: { in: [...ids] } }],
    },
    select: {
      date: true,
      type: true,
      amount: true,
      accountId: true,
      toAccountId: true,
    },
    orderBy: { date: "asc" },
  });

  const delta = (row: (typeof rows)[number]): bigint => {
    let change = 0n;

    if (ids.has(row.accountId)) {
      change += row.type === "INCOME" ? row.amount : -row.amount;
    }
    if (row.type === "TRANSFER" && row.toAccountId && ids.has(row.toAccountId)) {
      change += row.amount;
    }

    return change;
  };

  const assets = await assetValuesAt(points.map((point) => point.at));

  let running = opening;
  let cursor = 0;

  return points.map((point, index) => {
    while (cursor < rows.length && rows[cursor]!.date <= point.at) {
      running += delta(rows[cursor]!);
      cursor += 1;
    }

    const held = assets[index] ?? 0n;

    // Liabilities are not modelled yet (Sprint 4). The arithmetic is already
    // the one task 3.9 specifies; the third term is simply zero for now.
    return {
      at: point.at.toISOString(),
      label: point.label,
      balance: running.toString(),
      assets: held.toString(),
      liabilities: "0",
      netWorth: (running + held).toString(),
    };
  });
}

/** The first instant the household has any record of, or null. */
async function earliestRecord(accountIds: readonly string[]): Promise<Date | null> {
  const [movement, valuation] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        OR: [
          { accountId: { in: [...accountIds] } },
          { toAccountId: { in: [...accountIds] } },
        ],
      },
      _min: { date: true },
    }),
    prisma.assetValuation.aggregate({
      where: { asset: { isActive: true } },
      _min: { asOf: true },
    }),
  ]);

  const candidates = [movement._min.date, valuation._min.asOf].filter(
    (value): value is Date => value !== null,
  );

  if (candidates.length === 0) return null;

  return candidates.reduce((first, value) => (value < first ? value : first));
}

/**
 * The same series for a household with no accounts.
 *
 * Returning nothing here would have hidden a portfolio behind the absence of
 * a bank account — the chart would read as "no net worth" while the assets
 * page showed a flat worth billions.
 */
async function netWorthFromAssetsAlone(
  range: NetWorthRange,
  now: Date,
): Promise<NetWorthPoint[]> {
  const earliest =
    range === "ALL"
      ? ((await prisma.assetValuation.aggregate({ _min: { asOf: true } }))._min.asOf ??
        null)
      : null;

  const points = netWorthPointTimes(range, now, earliest);
  const values = await assetValuesAt(points.map((point) => point.at));

  if (values.every((value) => value === 0n)) return [];

  return points.map((point, index) => {
    const held = values[index] ?? 0n;

    return {
      at: point.at.toISOString(),
      label: point.label,
      balance: "0",
      assets: held.toString(),
      liabilities: "0",
      netWorth: held.toString(),
    };
  });
}
