import type { Owner } from "@/features/members/types";

import type { BudgetAlertKind, BudgetState } from "@/features/budgets/tracking";

export type { BudgetState, BudgetAlertKind };

/**
 * One category's budget for one month, as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2). `ratio` is the one number
 * here that is not money: it is a proportion for the progress bar.
 */
export type BudgetLineDto = {
  /** The budget row in force, or null for a category with none set. */
  id: string | null;
  categoryId: string;
  categoryName: string;
  /** The parent's name, for a child category. */
  parentName: string | null;
  icon: string | null;
  /** The limit for the month itself. */
  amount: string;
  /** Carried in from earlier months; "0" unless rollover is on. */
  carriedIn: string;
  /** Limit plus carry: what may actually be spent this month. */
  available: string;
  spent: string;
  /** Available minus spent. Negative when the month went over. */
  remaining: string;
  ratio: number;
  state: BudgetState;
  rollover: boolean;
  /** Whose spending this line measures (task 7.5). */
  owner: Owner;
};

/** Everything the budgets screen needs for one month. */
export type BudgetMonthDto = {
  /** The Jalali month, as `absoluteJalaliMonth` produces it. */
  month: number;
  year: number;
  monthOfYear: number;
  label: string;
  /** The scope being looked at: the household, or one person. */
  owner: Owner;
  lines: BudgetLineDto[];
  totals: {
    amount: string;
    available: string;
    spent: string;
    remaining: string;
    ratio: number;
    state: BudgetState;
  };
  alerts: BudgetAlertDto[];
};

export type BudgetAlertDto = {
  kind: BudgetAlertKind;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
};

/** One category's budget across several months, for the history view. */
export type BudgetHistoryPointDto = {
  month: number;
  label: string;
  amount: string;
  spent: string;
  state: BudgetState;
};
