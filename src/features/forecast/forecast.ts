import type { AccountType } from "@/generated/prisma/enums";

/**
 * Cash-flow forecasting arithmetic (tasks 6.6, 6.7 and 6.9).
 *
 * No database and no calendar of its own: a month here is the single integer
 * `absoluteJalaliMonth` produces, and every figure arrives already gathered.
 * That is what lets the part that actually matters — one month's closing
 * balance becoming the next one's opening balance, and where that first goes
 * negative — be tested without a database.
 */

/**
 * The periods the roadmap asks for (task 6.7).
 *
 * Each is a number of whole Jalali months counting the one in progress, so
 * "۱ ماه" is the rest of this month rather than the next thirty days.
 */
export const FORECAST_PERIODS = [1, 3, 6, 12] as const;

export type ForecastPeriod = (typeof FORECAST_PERIODS)[number];

export const FORECAST_PERIOD_LABELS: Record<ForecastPeriod, string> = {
  1: "۱ ماه",
  3: "۳ ماه",
  6: "۶ ماه",
  12: "۱۲ ماه",
};

/**
 * The account types whose balance is actually spendable this week.
 *
 * An investment account holds money the household would have to liquidate
 * first, and a business account is not the household's to spend. Counting
 * either as liquid would turn a real shortfall into a comfortable balance,
 * which is the one mistake this whole feature exists to prevent.
 */
export const LIQUID_ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "WALLET",
] as const satisfies readonly AccountType[];

export function isLiquid(type: AccountType): boolean {
  return (LIQUID_ACCOUNT_TYPES as readonly AccountType[]).includes(type);
}

/** One month's expected movements, all in whole Rial. */
export type ForecastMonthInput = {
  /** The absolute Jalali month. */
  month: number;
  /** What the household expects to earn; an estimate, see `expectedIncome`. */
  income: bigint;
  /** Loan instalments falling due. */
  loanPayments: bigint;
  /** Recurring payments falling due. */
  recurringExpenses: bigint;
  /**
   * Budgeted spending **net of the recurring payments inside those budgets**.
   *
   * Netting happens before this function, where the categories are known.
   * Adding a full budget on top of the recurring payments filed under it
   * would charge the household for its rent twice.
   */
  budgetedExpenses: bigint;
};

export type ForecastPoint = ForecastMonthInput & {
  /** What the household starts the month with. */
  openingBalance: bigint;
  /** Everything expected to go out. */
  outflow: bigint;
  /** Income minus outflow. Negative in a month that spends more than it earns. */
  net: bigint;
  /** What the household is left with. This is the next month's opening. */
  closingBalance: bigint;
  /** Whether the month ends in the red. */
  isShortfall: boolean;
};

/**
 * Project liquidity forward, month by month (task 6.6).
 *
 * Each month's closing balance opens the next, which is the whole point: a
 * month that only just holds up matters because of what it leaves the month
 * after it, and a forecast that computed every month from today's balance
 * would miss that entirely.
 */
export function forecast(
  openingBalance: bigint,
  months: ForecastMonthInput[],
): ForecastPoint[] {
  let balance = openingBalance;

  return months.map((month) => {
    const outflow =
      month.loanPayments + month.recurringExpenses + month.budgetedExpenses;
    const net = month.income - outflow;
    const opening = balance;

    balance = opening + net;

    return {
      ...month,
      openingBalance: opening,
      outflow,
      net,
      closingBalance: balance,
      isShortfall: balance < 0n,
    };
  });
}

/** The first month the forecast runs out of money, or null if none does. */
export function firstShortfall(points: ForecastPoint[]): ForecastPoint | null {
  return points.find((point) => point.isShortfall) ?? null;
}

/**
 * What the household can expect to earn in a month.
 *
 * The **median** of what it actually earned, not the mean. A household with
 * one bonus month would otherwise see every future month inflated by a
 * twelfth of that bonus, and a forecast that quietly overstates income is
 * worse than no forecast.
 *
 * An even count takes the lower of the two middles rather than averaging
 * them: the figure is money and must stay whole Rial (rule G.2), and erring
 * low is the right direction for an income estimate.
 */
export function expectedIncome(monthlyIncome: bigint[]): bigint {
  if (monthlyIncome.length === 0) return 0n;

  const sorted = [...monthlyIncome].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/* -------------------------------------------------------------------------
 * The near-term warning (task 6.9)
 * ---------------------------------------------------------------------- */

export type LiquidityWarning = {
  /** Spendable balance today, in Rial. */
  availableBalance: string;
  /** What falls due inside the window, in Rial. */
  expectedPayments: string;
  /** Payments minus balance, only when positive. */
  shortfall: string;
  /** How many days ahead the window looks. */
  days: number;
};

/**
 * Whether the week ahead is covered (task 6.9).
 *
 * Separate from the monthly forecast because it answers a different
 * question. A month can close comfortably and still have a week in the
 * middle of it where the rent, an instalment and a utility bill all land
 * before payday — and it is that week the household needs warning about.
 */
export function liquidityWarning(
  availableBalance: bigint,
  expectedPayments: bigint,
  days: number,
): LiquidityWarning | null {
  const shortfall = expectedPayments - availableBalance;

  if (shortfall <= 0n) return null;

  return {
    availableBalance: availableBalance.toString(),
    expectedPayments: expectedPayments.toString(),
    shortfall: shortfall.toString(),
    days,
  };
}
