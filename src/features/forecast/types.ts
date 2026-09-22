import type { ForecastPeriod, LiquidityWarning } from "@/features/forecast/forecast";

export type { ForecastPeriod, LiquidityWarning };

/**
 * One projected month, as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2).
 */
export type ForecastPointDto = {
  /** The absolute Jalali month. */
  month: number;
  /** Its name, for a chart axis. */
  label: string;
  openingBalance: string;
  income: string;
  loanPayments: string;
  recurringExpenses: string;
  budgetedExpenses: string;
  outflow: string;
  net: string;
  closingBalance: string;
  isShortfall: boolean;
};

export type ForecastDto = {
  period: ForecastPeriod;
  /** Spendable balance today, in Rial. */
  openingBalance: string;
  /** The estimate used for every projected month, in Rial. */
  expectedIncome: string;
  /** How many months of history the income estimate came from. */
  incomeMonths: number;
  points: ForecastPointDto[];
  /** The first month the household runs out, or null. */
  shortfallMonth: number | null;
  /** The near-term warning (task 6.9), or null when the week is covered. */
  warning: LiquidityWarning | null;
};
