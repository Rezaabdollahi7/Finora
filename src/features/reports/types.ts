import type { Owner } from "@/generated/prisma/enums";

import type { TrendDirection } from "@/features/reports/reporting";

export type { Owner, TrendDirection };

/**
 * Report figures as they cross a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2). Ratios are the only
 * numbers here that are not money, and a null ratio means "no basis to
 * compute one" rather than zero.
 */
export type ChangeDto = {
  current: string;
  previous: string;
  amount: string;
  ratio: number | null;
};

export type BucketDto = {
  key: string;
  label: string;
  amount: string;
  share: number;
};

/** One month in a series, for a chart axis or a table row. */
export type MonthlyPointDto = {
  month: number;
  label: string;
  income: string;
  expenses: string;
  savings: string;
  /** Null when there was no income to be a share of. */
  savingsRate: number | null;
  debtPayments: string;
  investments: string;
  netWorth: string;
};

/** The monthly financial report (task 8.1). */
export type MonthlyReportDto = {
  month: number;
  label: string;
  income: string;
  expenses: string;
  savings: string;
  savingsRate: number | null;
  /** What went into assets this month, at cost. */
  investments: string;
  /** Loan instalments actually paid this month. */
  debtPayments: string;
  netWorth: ChangeDto;
};

/** Income and expense breakdowns (tasks 8.2 and 8.3). */
export type BreakdownReportDto = {
  total: string;
  byMonth: { month: number; label: string; amount: string }[];
  byOwner: BucketDto[];
  byCategory: BucketDto[];
  byAccount: BucketDto[];
};

/** The savings report (task 8.4). */
export type SavingsReportDto = {
  income: string;
  expenses: string;
  savings: string;
  savingsRate: number | null;
  byMonth: MonthlyPointDto[];
};

/** The debt report (task 8.5). */
export type DebtReportDto = {
  originalDebt: string;
  paidDebt: string;
  remainingDebt: string;
  /** What the household owes each month while every loan is running. */
  monthlyBurden: string;
  upcoming: {
    loanId: string;
    loanName: string;
    number: number;
    dueDate: string;
    amount: string;
  }[];
};

/** The asset report (task 8.6). */
export type AssetReportDto = {
  totalValue: string;
  totalCost: string;
  profitAndLoss: string;
  allocation: BucketDto[];
  largest: { id: string; name: string; value: string; share: number }[];
  history: { date: string; label: string; value: string }[];
};

/** The net-worth report (task 8.7). */
export type NetWorthReportDto = {
  assets: string;
  liabilities: string;
  netWorth: ChangeDto;
  history: { date: string; label: string; value: string }[];
};

/** One category's behaviour over the range (task 8.8). */
export type CategoryObservationDto = {
  categoryId: string;
  categoryName: string;
  amount: string;
  share: number;
  /** Against the month before the range's last. */
  previous: string;
  trend: TrendDirection;
  /** The budget in force for the last month, if any. */
  budget: string | null;
};

export type ReportsDto = {
  from: { month: number; label: string };
  to: { month: number; label: string };
  filters: {
    owner: Owner | null;
    accountId: string | null;
    categoryId: string | null;
  };
  monthly: MonthlyReportDto;
  series: MonthlyPointDto[];
  income: BreakdownReportDto;
  expenses: BreakdownReportDto;
  savings: SavingsReportDto;
  debt: DebtReportDto;
  assets: AssetReportDto;
  netWorth: NetWorthReportDto;
  categories: CategoryObservationDto[];
};
