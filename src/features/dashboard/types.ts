import type { JalaliMonth } from "@/utils/date";

/**
 * Every figure the dashboard shows, for one Jalali month.
 *
 * Monetary values are decimal strings of whole Rial, like every other DTO in
 * the application (rule G.2).
 */
export type DashboardTotals = {
  /** Sum of every active account's balance at the end of the period. */
  totalBalance: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  /** income − expenses. Negative when the household spent more than it earned. */
  monthlySavings: string;
  assetValue: string;
  liabilityValue: string;
  /** assets + account balances − liabilities. */
  netWorth: string;
};

export type DashboardPeriod = JalaliMonth & {
  label: string;
  /** Half-open UTC interval, as ISO strings. */
  start: string;
  end: string;
};

/** A payment the household still owes, soonest first. */
export type UpcomingPayment = {
  id: string;
  title: string;
  amount: string;
  dueDate: string;
  kind: "LOAN_INSTALMENT" | "RECURRING" | "GOAL_CONTRIBUTION";
};

/** One category's budget for the period. */
export type BudgetStatus = {
  categoryId: string;
  categoryName: string;
  budget: string;
  spent: string;
  remaining: string;
  /** 0–1; may exceed 1 when over budget. */
  ratio: number;
};

export type DashboardSummary = {
  period: DashboardPeriod;
  current: DashboardTotals;
  /** The same figures for the previous Jalali month, for comparison. */
  previous: DashboardTotals;
  upcomingPayments: UpcomingPayment[];
  budgets: BudgetStatus[];
};

/** One month of the cash-flow chart. */
export type CashFlowPoint = {
  year: number;
  month: number;
  label: string;
  income: string;
  expenses: string;
  savings: string;
};

/** One slice of the expense distribution chart. */
export type CategoryExpense = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  amount: string;
  /** Share of the period's total expenses, 0–1. */
  share: number;
};
