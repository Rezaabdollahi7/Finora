import "server-only";

import type { Owner } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  absoluteJalaliMonth,
  fromAbsoluteJalaliMonth,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
} from "@/utils/date";
import { sumRial } from "@/utils/money";
import { multiplyByQuantity } from "@/utils/quantity";
import { OWNER_LABELS } from "@/features/accounts/types";
import { ASSET_TYPE_LABELS } from "@/features/assets/types";
import { assetFiltersSchema } from "@/features/assets/schemas";
import { listAssets } from "@/features/assets/server/asset-service";
import { loanFiltersSchema } from "@/features/loans/schemas";
import { listLoans } from "@/features/loans/server/loan-service";
import { totalBalanceAsOf } from "@/features/dashboard/server/dashboard-service";
import {
  change,
  rank,
  savingsRate,
  shares,
  trend,
  type Bucket,
} from "@/features/reports/reporting";
import type { ReportFilters } from "@/features/reports/schemas";
import type {
  AssetReportDto,
  BreakdownReportDto,
  BucketDto,
  CategoryObservationDto,
  ChangeDto,
  DebtReportDto,
  MonthlyPointDto,
  MonthlyReportDto,
  NetWorthReportDto,
  ReportsDto,
  SavingsReportDto,
} from "@/features/reports/types";

/**
 * Reporting (tasks 8.1–8.9).
 *
 * The arithmetic is in `reporting.ts` and has no database; this file gathers
 * what it needs and applies the filters.
 *
 * **One pass over the range, not one per report.** Every breakdown here —
 * by month, owner, category and account, for income and for expenses alike —
 * is folded out of a single `findMany` over the window. Six reports each
 * running their own query would be six scans of the same rows, and the
 * bucketing has to happen in TypeScript anyway because the months are Jalali
 * and PostgreSQL has no Persian calendar.
 *
 * Transfers are excluded from every income and expense figure by the type
 * filter, not by hoping none exist (rule G.3).
 */

/** How many months a report covers when the household does not say. */
const DEFAULT_MONTHS = 6;

/** How many of the largest assets the asset report names (task 8.6). */
const LARGEST_ASSETS = 5;

/** How many instalments the debt report lists ahead (task 8.5). */
const UPCOMING_INSTALLMENTS = 6;

type MovementRow = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: bigint;
  date: Date;
  owner: Owner;
  accountId: string;
  categoryId: string | null;
};

type Naming = {
  accounts: Map<string, string>;
  categories: Map<string, string>;
  /** A child category's parent, for rolling a breakdown up one level. */
  parentOf: Map<string, string>;
};

function label(month: number): string {
  const { year, month: monthOfYear } = fromAbsoluteJalaliMonth(month);
  return jalaliMonthLabel({ year, month: monthOfYear });
}

function shortLabel(month: number): string {
  const { year, month: monthOfYear } = fromAbsoluteJalaliMonth(month);
  return jalaliMonthLabel({ year, month: monthOfYear }, { withYear: false });
}

function toChangeDto(value: ReturnType<typeof change>): ChangeDto {
  return {
    current: value.current.toString(),
    previous: value.previous.toString(),
    amount: value.amount.toString(),
    ratio: value.ratio,
  };
}

function toBucketDtos(buckets: Bucket[]): BucketDto[] {
  return shares(rank(buckets)).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    amount: bucket.amount.toString(),
    share: bucket.share,
  }));
}

/** Sum a map into ranked, shared buckets. */
function bucketsOf(
  totals: Map<string, bigint>,
  naming: (key: string) => string,
): BucketDto[] {
  return toBucketDtos(
    [...totals.entries()]
      .filter(([, amount]) => amount > 0n)
      .map(([key, amount]) => ({ key, label: naming(key), amount })),
  );
}

export async function getReports(
  filters: ReportFilters,
  now: Date = new Date(),
): Promise<ReportsDto> {
  const currentMonth = absoluteJalaliMonth(jalaliMonthOf(now));
  const toMonth = filters.toMonth ?? currentMonth;
  const fromMonth = filters.fromMonth ?? toMonth - (DEFAULT_MONTHS - 1);

  const months = Array.from(
    { length: toMonth - fromMonth + 1 },
    (_, index) => fromMonth + index,
  );

  // One month before the range, so every "against last month" figure has
  // something to compare with rather than reporting a change from nothing.
  const windowStart = jalaliMonthRange(fromAbsoluteJalaliMonth(fromMonth - 1)).start;
  const windowEnd = jalaliMonthRange(fromAbsoluteJalaliMonth(toMonth)).end;

  const [rows, naming, debtPaidByMonth, investedByMonth, cashByMonth] =
    await Promise.all([
      loadMovements(filters, windowStart, windowEnd),
      loadNames(),
      loadDebtPaidByMonth(filters, windowStart, windowEnd),
      loadInvestedByMonth(filters, windowStart, windowEnd),
      loadCashByMonth(months, windowEnd, now),
    ]);

  const inRange = rows.filter((row) => monthOf(row) >= fromMonth);

  const series = buildSeries(months, inRange, debtPaidByMonth, investedByMonth);
  const income = buildBreakdown(months, inRange, "INCOME", naming);
  const expenses = buildBreakdown(months, inRange, "EXPENSE", naming);

  const [debt, assets, netWorth] = await Promise.all([
    buildDebtReport(filters, now),
    buildAssetReport(filters, months),
    buildNetWorthReport(filters, months, cashByMonth, now),
  ]);

  for (const point of series) {
    point.netWorth =
      netWorth.history.find((entry) => entry.label === point.label)?.value ?? "0";
  }

  // The monthly report is the range's last month, which is what "this
  // month's report" means when the range ends today.
  const last = series.at(-1)!;
  const previousMonthRows = rows.filter((row) => monthOf(row) === fromMonth - 1);

  const monthly: MonthlyReportDto = {
    month: last.month,
    label: last.label,
    income: last.income,
    expenses: last.expenses,
    savings: last.savings,
    savingsRate: last.savingsRate,
    investments: last.investments,
    debtPayments: last.debtPayments,
    netWorth: netWorth.netWorth,
  };

  return {
    from: { month: fromMonth, label: label(fromMonth) },
    to: { month: toMonth, label: label(toMonth) },
    filters: {
      owner: filters.owner ?? null,
      accountId: filters.accountId ?? null,
      categoryId: filters.categoryId ?? null,
    },
    monthly,
    series,
    income,
    expenses,
    savings: buildSavingsReport(series),
    debt,
    assets,
    netWorth,
    categories: await buildCategoryObservations(
      months,
      inRange,
      previousMonthRows,
      naming,
    ),
  };
}

/* -------------------------------------------------------------------------
 * Gathering
 * ---------------------------------------------------------------------- */

function monthOf(row: { date: Date }): number {
  return absoluteJalaliMonth(jalaliMonthOf(row.date));
}

/**
 * Every movement in the window, filtered (task 8.9).
 *
 * The account filter matches either side of a transfer, because "show me
 * this account" means everything that touched it. The category filter
 * matches the category or any of its children, so filtering by "food" does
 * not silently drop the restaurants inside it.
 */
async function loadMovements(
  filters: ReportFilters,
  start: Date,
  end: Date,
): Promise<MovementRow[]> {
  const categoryIds = filters.categoryId
    ? [
        filters.categoryId,
        ...(
          await prisma.category.findMany({
            where: { parentId: filters.categoryId },
            select: { id: true },
          })
        ).map((child) => child.id),
      ]
    : undefined;

  return prisma.transaction.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(filters.owner ? { owner: filters.owner } : {}),
      ...(filters.accountId
        ? {
            OR: [{ accountId: filters.accountId }, { toAccountId: filters.accountId }],
          }
        : {}),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    },
    select: {
      type: true,
      amount: true,
      date: true,
      owner: true,
      accountId: true,
      categoryId: true,
    },
    orderBy: { date: "asc" },
  });
}

/**
 * Loan instalments actually paid, per Jalali month (task 8.1).
 *
 * Paid, not due: a report of what a month cost is about the money that left,
 * and an instalment the household missed did not cost it anything yet.
 */
async function loadDebtPaidByMonth(
  filters: ReportFilters,
  start: Date,
  end: Date,
): Promise<Map<number, bigint>> {
  const rows = await prisma.installment.findMany({
    where: {
      paidAt: { gte: start, lt: end },
      ...(filters.owner ? { loan: { owner: filters.owner } } : {}),
    },
    select: { paidAt: true, amount: true },
  });

  const totals = new Map<number, bigint>();

  for (const row of rows) {
    const month = absoluteJalaliMonth(jalaliMonthOf(row.paidAt!));
    totals.set(month, (totals.get(month) ?? 0n) + row.amount);
  }

  return totals;
}

/**
 * What the household put into assets, per Jalali month (task 8.1).
 *
 * At cost rather than at today's value: the month it bought the gold, it
 * spent what it paid. Re-valuing it later is a gain, not a purchase.
 */
async function loadInvestedByMonth(
  filters: ReportFilters,
  start: Date,
  end: Date,
): Promise<Map<number, bigint>> {
  const rows = await prisma.asset.findMany({
    where: {
      purchaseDate: { gte: start, lt: end },
      ...(filters.owner ? { owner: filters.owner } : {}),
    },
    select: { purchaseDate: true, purchaseUnitPrice: true, quantity: true },
  });

  const totals = new Map<number, bigint>();

  for (const row of rows) {
    const month = absoluteJalaliMonth(jalaliMonthOf(row.purchaseDate));
    // There is no purchaseTotal column: the cost is the unit price times the
    // quantity, rounded in the one place that does it (see utils/quantity).
    const cost = multiplyByQuantity(row.purchaseUnitPrice, row.quantity);
    totals.set(month, (totals.get(month) ?? 0n) + cost);
  }

  return totals;
}

/**
 * The cash balance at the end of each month in the range.
 *
 * **One query for the whole series**, not one per month. Every movement from
 * the beginning of time to the end of the range is read once and carried
 * forward, which is what the dashboard's net-worth chart does and for the
 * same reason: twelve months must not cost four times what three costs
 * (task 8.17).
 *
 * The filters do not apply here. A balance is a fact about an account, and
 * showing "Reza's net worth" as the balance of transactions he happened to
 * own would be a different and much stranger number.
 */
async function loadCashByMonth(
  months: number[],
  end: Date,
  now: Date,
): Promise<Map<number, bigint>> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: { id: true, initialBalance: true },
  });

  const ids = new Set(accounts.map((account) => account.id));
  let balance = accounts.reduce((sum, account) => sum + account.initialBalance, 0n);

  const rows = await prisma.transaction.findMany({
    where: { date: { lt: end } },
    select: {
      date: true,
      type: true,
      amount: true,
      accountId: true,
      toAccountId: true,
    },
    orderBy: { date: "asc" },
  });

  const totals = new Map<number, bigint>();
  let cursor = 0;

  for (const month of months) {
    const monthEnd = jalaliMonthRange(fromAbsoluteJalaliMonth(month)).end;
    const at = monthEnd > now ? now : monthEnd;

    while (cursor < rows.length && rows[cursor]!.date < at) {
      const row = rows[cursor]!;

      // A transfer moves money between two accounts, so it nets to zero
      // across the household unless one side sits outside it (rule G.3).
      if (ids.has(row.accountId)) {
        balance += row.type === "INCOME" ? row.amount : -row.amount;
      }
      if (row.type === "TRANSFER" && row.toAccountId && ids.has(row.toAccountId)) {
        balance += row.amount;
      }

      cursor += 1;
    }

    totals.set(month, balance);
  }

  return totals;
}

async function loadNames(): Promise<Naming> {
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);

  return {
    accounts: new Map(accounts.map((row) => [row.id, row.name])),
    categories: new Map(categories.map((row) => [row.id, row.name])),
    parentOf: new Map(
      categories
        .filter((row) => row.parentId !== null)
        .map((row) => [row.id, row.parentId!]),
    ),
  };
}

/* -------------------------------------------------------------------------
 * The reports
 * ---------------------------------------------------------------------- */

function buildSeries(
  months: number[],
  rows: MovementRow[],
  debtPaid: Map<number, bigint>,
  invested: Map<number, bigint>,
): MonthlyPointDto[] {
  const income = new Map<number, bigint>();
  const expenses = new Map<number, bigint>();

  for (const row of rows) {
    if (row.type === "TRANSFER") continue;

    const bucket = row.type === "INCOME" ? income : expenses;
    const month = monthOf(row);
    bucket.set(month, (bucket.get(month) ?? 0n) + row.amount);
  }

  return months.map((month) => {
    const earned = income.get(month) ?? 0n;
    const spent = expenses.get(month) ?? 0n;

    return {
      month,
      label: shortLabel(month),
      income: earned.toString(),
      expenses: spent.toString(),
      savings: (earned - spent).toString(),
      savingsRate: savingsRate(earned, earned - spent),
      // Instalments and asset purchases are not visible in the movement
      // rows — an instalment is an ordinary expense there, and buying gold
      // moves no money through a category at all — so both are loaded
      // separately and joined here.
      debtPayments: (debtPaid.get(month) ?? 0n).toString(),
      investments: (invested.get(month) ?? 0n).toString(),
      // Filled once the net-worth pass has walked the months.
      netWorth: "0",
    };
  });
}

function buildBreakdown(
  months: number[],
  rows: MovementRow[],
  type: "INCOME" | "EXPENSE",
  naming: Naming,
): BreakdownReportDto {
  const matching = rows.filter((row) => row.type === type);

  const byMonth = new Map<number, bigint>();
  const byOwner = new Map<string, bigint>();
  const byCategory = new Map<string, bigint>();
  const byAccount = new Map<string, bigint>();

  for (const row of matching) {
    const month = monthOf(row);
    byMonth.set(month, (byMonth.get(month) ?? 0n) + row.amount);
    byOwner.set(row.owner, (byOwner.get(row.owner) ?? 0n) + row.amount);
    byAccount.set(row.accountId, (byAccount.get(row.accountId) ?? 0n) + row.amount);

    // Rolled up to the top-level category: "خوراک" is the line a household
    // reads, and splitting it across four children buries it.
    const key = row.categoryId
      ? (naming.parentOf.get(row.categoryId) ?? row.categoryId)
      : "__none__";
    byCategory.set(key, (byCategory.get(key) ?? 0n) + row.amount);
  }

  return {
    total: sumRial(matching.map((row) => row.amount)).toString(),
    byMonth: months.map((month) => ({
      month,
      label: shortLabel(month),
      amount: (byMonth.get(month) ?? 0n).toString(),
    })),
    byOwner: bucketsOf(byOwner, (key) => OWNER_LABELS[key as Owner] ?? key),
    byCategory: bucketsOf(
      byCategory,
      (key) => naming.categories.get(key) ?? "بدون دسته",
    ),
    byAccount: bucketsOf(
      byAccount,
      (key) => naming.accounts.get(key) ?? "حساب حذف‌شده",
    ),
  };
}

function buildSavingsReport(series: MonthlyPointDto[]): SavingsReportDto {
  const income = sumRial(series.map((point) => BigInt(point.income)));
  const expenses = sumRial(series.map((point) => BigInt(point.expenses)));
  const savings = income - expenses;

  return {
    income: income.toString(),
    expenses: expenses.toString(),
    savings: savings.toString(),
    savingsRate: savingsRate(income, savings),
    byMonth: series,
  };
}

async function buildDebtReport(
  filters: ReportFilters,
  now: Date,
): Promise<DebtReportDto> {
  const loans = (await listLoans(loanFiltersSchema.parse({}), now)).filter(
    (loan) =>
      loan.status !== "ARCHIVED" && (!filters.owner || loan.owner === filters.owner),
  );

  const upcoming = await prisma.installment.findMany({
    where: {
      paidAt: null,
      loan: {
        status: { not: "ARCHIVED" },
        ...(filters.owner ? { owner: filters.owner } : {}),
      },
    },
    select: {
      number: true,
      dueDate: true,
      amount: true,
      loan: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: UPCOMING_INSTALLMENTS,
  });

  return {
    // What was borrowed, not what will be repaid: the interest is in the
    // instalments, and adding both would count it twice.
    originalDebt: sumRial(loans.map((loan) => BigInt(loan.principalAmount))).toString(),
    paidDebt: sumRial(loans.map((loan) => BigInt(loan.progress.paidAmount))).toString(),
    remainingDebt: sumRial(
      loans.map((loan) => BigInt(loan.progress.remainingAmount)),
    ).toString(),
    // Every active loan's instalment, which is what a month costs while all
    // of them are running. A settled loan costs nothing and is left out.
    monthlyBurden: sumRial(
      loans
        .filter((loan) => loan.status === "ACTIVE")
        .map((loan) => BigInt(loan.installmentAmount)),
    ).toString(),
    upcoming: upcoming.map((row) => ({
      loanId: row.loan.id,
      loanName: row.loan.name,
      number: row.number,
      dueDate: row.dueDate.toISOString(),
      amount: row.amount.toString(),
    })),
  };
}

async function buildAssetReport(
  filters: ReportFilters,
  months: number[],
): Promise<AssetReportDto> {
  const assets = (await listAssets(assetFiltersSchema.parse({}))).filter(
    (asset) => !filters.owner || asset.owner === filters.owner,
  );

  const byType = new Map<string, bigint>();
  for (const asset of assets) {
    byType.set(asset.type, (byType.get(asset.type) ?? 0n) + BigInt(asset.currentValue));
  }

  const totalValue = sumRial(assets.map((asset) => BigInt(asset.currentValue)));
  const totalCost = sumRial(assets.map((asset) => BigInt(asset.purchaseTotal)));

  const ranked = rank(
    assets.map((asset) => ({
      key: asset.id,
      label: asset.name,
      amount: BigInt(asset.currentValue),
    })),
  );

  return {
    totalValue: totalValue.toString(),
    totalCost: totalCost.toString(),
    profitAndLoss: (totalValue - totalCost).toString(),
    allocation: bucketsOf(
      byType,
      (key) => ASSET_TYPE_LABELS[key as keyof typeof ASSET_TYPE_LABELS] ?? key,
    ),
    largest: shares(ranked)
      .slice(0, LARGEST_ASSETS)
      .map((entry) => ({
        id: entry.key,
        name: entry.label,
        value: entry.amount.toString(),
        share: entry.share,
      })),
    history: await assetValueByMonth(months, filters),
  };
}

/**
 * What the holdings were worth at the end of each month (task 8.6).
 *
 * Two queries for the whole series: the assets, and every valuation of them.
 * Each month takes the latest valuation on or before its end, which is what
 * makes the line honest — re-pricing gold today must not rewrite what the
 * portfolio was worth in Mordad (rule G.4).
 */
async function assetValueByMonth(
  months: number[],
  filters: ReportFilters,
): Promise<AssetReportDto["history"]> {
  const assets = await prisma.asset.findMany({
    where: {
      isActive: true,
      ...(filters.owner ? { owner: filters.owner } : {}),
    },
    select: { id: true },
  });

  if (assets.length === 0) {
    return months.map((month) => ({
      date: jalaliMonthRange(fromAbsoluteJalaliMonth(month)).end.toISOString(),
      label: shortLabel(month),
      value: "0",
    }));
  }

  const valuations = await prisma.assetValuation.findMany({
    where: { assetId: { in: assets.map((asset) => asset.id) } },
    select: { assetId: true, asOf: true, value: true },
    orderBy: { asOf: "asc" },
  });

  const latest = new Map<string, bigint>();
  let total = 0n;
  let cursor = 0;

  return months.map((month) => {
    const end = jalaliMonthRange(fromAbsoluteJalaliMonth(month)).end;

    while (cursor < valuations.length && valuations[cursor]!.asOf < end) {
      const row = valuations[cursor]!;
      // Replace this asset's contribution rather than adding to it, the
      // same sweep the portfolio history uses.
      total += row.value - (latest.get(row.assetId) ?? 0n);
      latest.set(row.assetId, row.value);
      cursor += 1;
    }

    return {
      date: end.toISOString(),
      label: shortLabel(month),
      value: total.toString(),
    };
  });
}

async function buildNetWorthReport(
  filters: ReportFilters,
  months: number[],
  cashByMonth: Map<number, bigint>,
  now: Date,
): Promise<NetWorthReportDto> {
  const [assets, loans] = await Promise.all([
    listAssets(assetFiltersSchema.parse({})),
    listLoans(loanFiltersSchema.parse({}), now),
  ]);

  const owned = assets.filter(
    (asset) => !filters.owner || asset.owner === filters.owner,
  );
  const owed = loans.filter(
    (loan) =>
      loan.status !== "ARCHIVED" && (!filters.owner || loan.owner === filters.owner),
  );

  const assetValue = sumRial(owned.map((asset) => BigInt(asset.currentValue)));
  const liabilities = sumRial(
    owed.map((loan) => BigInt(loan.progress.remainingAmount)),
  );

  const assetHistory = await assetValueByMonth(months, filters);

  // The end of each month in the range, cut off at today for the month in
  // progress so the line ends where the household actually is.
  const history = months.map((month, index) => {
    const end = jalaliMonthRange(fromAbsoluteJalaliMonth(month)).end;
    const at = end > now ? now : end;

    return {
      date: at.toISOString(),
      label: shortLabel(month),
      // Cash and holdings both carry their own history. Debts do not: a
      // loan's remaining balance is derived from which instalments are paid
      // *now*, so the line holds today's figure flat across the range. That
      // limit is written down rather than hidden.
      value: (
        (cashByMonth.get(month) ?? 0n) +
        BigInt(assetHistory[index]!.value) -
        liabilities
      ).toString(),
    };
  });

  const cashNow = await totalBalanceAsOf(now);
  const current = assetValue + cashNow - liabilities;
  const previous = history.length > 1 ? BigInt(history.at(-2)!.value) : current;

  return {
    assets: (assetValue + cashNow).toString(),
    liabilities: liabilities.toString(),
    netWorth: toChangeDto(change(current, previous)),
    history,
  };
}

async function buildCategoryObservations(
  months: number[],
  rows: MovementRow[],
  previousMonthRows: MovementRow[],
  naming: Naming,
): Promise<CategoryObservationDto[]> {
  const lastMonth = months.at(-1)!;

  const totalFor = (source: MovementRow[], month: number | null) => {
    const totals = new Map<string, bigint>();

    for (const row of source) {
      if (row.type !== "EXPENSE") continue;
      if (month !== null && monthOf(row) !== month) continue;

      const key = row.categoryId
        ? (naming.parentOf.get(row.categoryId) ?? row.categoryId)
        : "__none__";
      totals.set(key, (totals.get(key) ?? 0n) + row.amount);
    }

    return totals;
  };

  const overRange = totalFor(rows, null);
  const thisMonth = totalFor(rows, lastMonth);
  const before =
    months.length > 1
      ? totalFor(rows, lastMonth - 1)
      : totalFor(previousMonthRows, null);

  const budgets = await prisma.budget.findMany({
    where: {
      owner: "SHARED",
      fromMonth: { lte: lastMonth },
      OR: [{ toMonth: null }, { toMonth: { gte: lastMonth } }],
    },
    select: { categoryId: true, amount: true },
  });

  const budgetOf = new Map(budgets.map((row) => [row.categoryId, row.amount]));

  return shares(
    rank(
      [...overRange.entries()].map(([key, amount]) => ({
        key,
        label: naming.categories.get(key) ?? "بدون دسته",
        amount,
      })),
    ),
  ).map((bucket) => {
    const current = thisMonth.get(bucket.key) ?? 0n;
    const previous = before.get(bucket.key) ?? 0n;

    return {
      categoryId: bucket.key,
      categoryName: bucket.label,
      amount: bucket.amount.toString(),
      share: bucket.share,
      previous: previous.toString(),
      trend: trend(current, previous),
      budget: budgetOf.get(bucket.key)?.toString() ?? null,
    };
  });
}
