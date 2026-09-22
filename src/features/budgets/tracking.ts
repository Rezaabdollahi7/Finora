/**
 * Budget arithmetic (tasks 5.7, 5.9, 5.10).
 *
 * No database and no dates-as-instants: a budget lives in whole Jalali
 * months, and a month here is the single integer `absoluteJalaliMonth`
 * produces. Keeping the arithmetic in one place with no I/O is what lets the
 * rollover chain — the only genuinely subtle part — be tested directly.
 */

/** How a budget is doing, for the progress bar and the alerts. */
export const BUDGET_STATES = ["NORMAL", "WARNING", "OVER"] as const;

export type BudgetState = (typeof BUDGET_STATES)[number];

export const BUDGET_STATE_LABELS: Record<BudgetState, string> = {
  NORMAL: "در محدوده",
  WARNING: "نزدیک سقف",
  OVER: "بیش از بودجه",
};

/**
 * The share of a budget at which it stops being comfortable.
 *
 * The roadmap's own first alert (task 5.10). It is a ratio rather than a
 * percentage so nothing has to divide by a hundred to use it.
 */
export const WARNING_RATIO = 0.8;

/** One month's outcome for one category. */
export type BudgetMonth = {
  /** The limit set for the month itself, in Rial. */
  amount: bigint;
  /** Carried in from previous months. Zero unless rollover is on. */
  carriedIn: bigint;
  /** The limit plus what was carried in: what may actually be spent. */
  available: bigint;
  /** What was spent against the category in the month, in Rial. */
  spent: bigint;
  /** Available minus spent. Negative when the month went over. */
  remaining: bigint;
  /**
   * Spent over available, as a fraction. Above one when over budget.
   *
   * A ratio rather than a percentage, and a `number` rather than a `bigint`:
   * it is a proportion for a progress bar, never money (rule G.2).
   */
  ratio: number;
  state: BudgetState;
};

/**
 * Where a category stands.
 *
 * Spending a budget to its last Rial is at the limit, not past it — so the
 * comparison is strict. A category with no money available is over the
 * moment anything is spent against it.
 */
export function budgetState(available: bigint, spent: bigint): BudgetState {
  if (spent > available) return "OVER";
  if (available === 0n) return "NORMAL";

  return ratioOf(available, spent) >= WARNING_RATIO ? "WARNING" : "NORMAL";
}

/**
 * Spent over available, as a fraction.
 *
 * Division through Number is safe here and only here: the result is a
 * proportion for a progress bar, and neither operand is used as money again
 * afterwards. Scaling first keeps the fraction meaningful for figures past
 * 2^53 — a budget in Rial passes that at 900 billion Toman, which a
 * property-buying year can reach.
 *
 * Nothing available means there is no proportion to express, so it reports a
 * full bar rather than Infinity: a bar cannot draw Infinity, and JSON cannot
 * even carry it — `JSON.stringify(Infinity)` is `null`, which would arrive
 * at the client as a missing number rather than an extreme one. What
 * actually happened is in `spent`, `available` and the OVER state beside it.
 */
function ratioOf(available: bigint, spent: bigint): number {
  if (available <= 0n) return spent > 0n ? 1 : 0;

  const SCALE = 1_000_000n;

  return Number((spent * SCALE) / available) / Number(SCALE);
}

/** One month of input for the rollover chain. */
export type MonthInput = {
  /** The absolute Jalali month. */
  month: number;
  /** The limit in force that month, in Rial. */
  amount: bigint;
  /** What was spent that month, in Rial. */
  spent: bigint;
};

/**
 * Walk a run of months, carrying the surplus forward (task 5.9).
 *
 * Only a surplus carries. The roadmap asks for "unused money" to move
 * forward, and a deficit is not unused money — carrying it would silently
 * shrink next month's budget for a reason invisible inside next month, which
 * is how a household ends up wondering why it is over on food in Mehr for
 * something it did in Mordad.
 *
 * `months` must be consecutive and in order; each one's carry-in is the
 * previous one's surplus, so a gap would attribute a surplus to the wrong
 * month.
 */
export function foldRollover(
  months: MonthInput[],
  { rollover }: { rollover: boolean },
): BudgetMonth[] {
  let carriedIn = 0n;

  return months.map((month) => {
    const available = month.amount + carriedIn;
    const remaining = available - month.spent;
    const result: BudgetMonth = {
      amount: month.amount,
      carriedIn,
      available,
      spent: month.spent,
      remaining,
      ratio: ratioOf(available, month.spent),
      state: budgetState(available, month.spent),
    };

    // A month that went over does not hand a debt to the next one.
    carriedIn = rollover && remaining > 0n ? remaining : 0n;

    return result;
  });
}

/** One month with no history behind it. */
export function budgetMonth(amount: bigint, spent: bigint): BudgetMonth {
  return foldRollover([{ month: 0, amount, spent }], { rollover: false })[0]!;
}

/* -------------------------------------------------------------------------
 * Alerts (task 5.10)
 * ---------------------------------------------------------------------- */

export const BUDGET_ALERT_KINDS = [
  "NEAR_LIMIT",
  "OVER_BUDGET",
  "CASH_SHORTFALL",
] as const;

export type BudgetAlertKind = (typeof BUDGET_ALERT_KINDS)[number];

export type BudgetAlert = {
  kind: BudgetAlertKind;
  /** The category the alert is about, or null for a household-wide one. */
  categoryId: string | null;
  categoryName: string | null;
  /** The figure the alert turns on, in Rial. */
  amount: bigint;
};

/**
 * What the household should be told about this month.
 *
 * Three conditions, in the roadmap's own order: a budget at eighty per cent,
 * a budget past its limit, and — regardless of any budget — payments falling
 * due that the accounts cannot cover.
 *
 * A category raises at most one alert. A budget that is over is not also
 * "near its limit"; saying both would double-count one problem.
 */
export function budgetAlerts(
  categories: {
    categoryId: string;
    categoryName: string;
    month: BudgetMonth;
  }[],
  cash: { availableBalance: bigint; upcomingObligations: bigint },
): BudgetAlert[] {
  const alerts = categories.flatMap<BudgetAlert>(
    ({ categoryId, categoryName, month }) => {
      if (month.state === "OVER") {
        return [
          {
            kind: "OVER_BUDGET",
            categoryId,
            categoryName,
            // How far past, which is the number that needs covering.
            amount: month.spent - month.available,
          },
        ];
      }

      if (month.state === "WARNING") {
        return [
          {
            kind: "NEAR_LIMIT",
            categoryId,
            categoryName,
            // How much is left, which is the number that has to last.
            amount: month.remaining,
          },
        ];
      }

      return [];
    },
  );

  const shortfall = cash.upcomingObligations - cash.availableBalance;

  if (shortfall > 0n) {
    alerts.push({
      kind: "CASH_SHORTFALL",
      categoryId: null,
      categoryName: null,
      amount: shortfall,
    });
  }

  return alerts;
}
