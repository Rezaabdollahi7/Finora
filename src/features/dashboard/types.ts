import type { JalaliMonth } from "@/utils/date";
import type { CalendarEventKind } from "@/features/calendar/types";

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
  /*
   * Reuses the calendar's list rather than keeping a second one. Sprint 2
   * declared these independently and Sprint 4 arrived with a different
   * spelling of "instalment" — two enums for one idea, disagreeing.
   */
  kind: CalendarEventKind;
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

/** One account's share of the household's liquid money. */
export type AccountShare = {
  accountId: string;
  name: string;
  type: string;
  owner: string;
  balance: string;
  /** Share of the household's positive liquid total, 0–1. */
  share: number;
};

/** The spans the net-worth chart can be asked for (task 2.6). */
export const NET_WORTH_RANGES = ["MONTH", "M3", "M6", "YEAR", "ALL"] as const;

export type NetWorthRange = (typeof NET_WORTH_RANGES)[number];

export const NET_WORTH_RANGE_LABELS: Record<NetWorthRange, string> = {
  MONTH: "این ماه",
  M3: "۳ ماه",
  M6: "۶ ماه",
  YEAR: "۱ سال",
  ALL: "همه",
};

/** One point on the net-worth line. */
export type NetWorthPoint = {
  /** ISO-8601 UTC instant the value is measured at. */
  at: string;
  label: string;
  netWorth: string;
  balance: string;
  assets: string;
  liabilities: string;
};

/** Upcoming payments, bucketed the way the widget reads them (task 2.8). */
export type UpcomingBucket = {
  key: "TODAY" | "TOMORROW" | "THIS_WEEK" | "NEXT_WEEK" | "THIS_MONTH" | "LATER";
  label: string;
  payments: UpcomingPayment[];
  total: string;
};
