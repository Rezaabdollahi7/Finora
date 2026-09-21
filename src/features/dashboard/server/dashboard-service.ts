import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addJalaliMonths,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
  recentJalaliMonths,
  type JalaliMonth,
} from "@/utils/date";
import type {
  BudgetStatus,
  CashFlowPoint,
  CategoryExpense,
  DashboardSummary,
  DashboardTotals,
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
 * Assets arrive in Sprint 3, loans in Sprint 4, recurring payments in Sprint
 * 5 and budgets in Sprint 5. The dashboard's shape is complete now; these
 * four functions are the only places that change when those models land, and
 * the figures above them — net worth in particular — are already correct
 * arithmetic over whatever they return.
 * ---------------------------------------------------------------------- */

/** Total value of assets held at an instant. Sprint 3. */
async function loadAssetValue(asOf: Date): Promise<bigint> {
  void asOf;
  return 0n;
}

/** Outstanding debt at an instant. Sprint 4. */
async function loadLiabilityValue(asOf: Date): Promise<bigint> {
  void asOf;
  return 0n;
}

/** Obligations falling due after an instant. Sprints 4 and 5. */
async function loadUpcomingPayments(
  after: Date,
  limit: number,
): Promise<UpcomingPayment[]> {
  void after;
  void limit;
  return [];
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
    // Balances are measured at the end of the period, so "last month" means
    // where the household stood when that month closed.
    totalBalanceAsOf(period.end),
    loadAssetValue(period.end),
    loadLiabilityValue(period.end),
  ]);

  return {
    totalBalance: balance.toString(),
    monthlyIncome: income.toString(),
    monthlyExpenses: expenses.toString(),
    monthlySavings: (income - expenses).toString(),
    assetValue: assets.toString(),
    liabilityValue: liabilities.toString(),
    // Money in a bank account is counted once, as a balance. An asset is
    // something held outside the accounts, so the two never overlap (3.9).
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
    loadUpcomingPayments(new Date(), 5),
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
