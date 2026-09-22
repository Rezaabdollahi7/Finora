/**
 * Goal arithmetic (tasks 6.3 and 6.5).
 *
 * No database and no I/O, so the one genuinely subtle part — what a goal
 * still needs each month to land on its date — can be tested directly.
 */

/**
 * Where a goal stands.
 *
 * Deliberately only what the data can actually answer. An "behind schedule"
 * state would need to compare against a straight line from when the goal was
 * set, and a goal does not record when that was — inferring it from the row's
 * creation timestamp would dress a technical field up as a financial one.
 *
 * What the household needs instead is already here: `monthlyContribution`
 * rises on its own as a goal falls behind, which is both the warning and the
 * instruction.
 */
export const GOAL_STATES = ["IN_PROGRESS", "REACHED", "OVERDUE"] as const;

export type GoalState = (typeof GOAL_STATES)[number];

export const GOAL_STATE_LABELS: Record<GoalState, string> = {
  IN_PROGRESS: "در جریان",
  REACHED: "رسیده",
  OVERDUE: "مهلت گذشته",
};

/** One contribution, as the arithmetic needs it. */
export type ContributionInput = {
  amount: bigint;
  /** True when money came back out of the goal. */
  isWithdrawal: boolean;
};

export type GoalProgress = {
  /** What the household is aiming for, in Rial. */
  targetAmount: bigint;
  /** What has been put aside, net of withdrawals, in Rial. */
  currentAmount: bigint;
  /** Target minus current, floored at zero: a goal cannot need less than nothing. */
  remainingAmount: bigint;
  /**
   * Current over target, as a fraction. Capped at one.
   *
   * A `number` rather than a `bigint` because it is a proportion for a
   * progress bar, never money (rule G.2).
   */
  ratio: number;
  isReached: boolean;
  /** Whole Jalali months from now to the target date, or null without one. */
  monthsRemaining: number | null;
  /**
   * What must go in each month to land on the date, in Rial.
   *
   * Null when there is no date to land on, and zero once the goal is
   * reached. The month in progress counts: a goal due at the end of next
   * month has two months to fill, not one.
   */
  monthlyContribution: bigint | null;
  state: GoalState;
};

/**
 * Net of withdrawals, never below zero.
 *
 * Taking more out than went in is a data-entry slip rather than a negative
 * saving, and a bar drawn from a negative figure would point the wrong way.
 */
function netContributed(contributions: ContributionInput[]): bigint {
  const total = contributions.reduce(
    (sum, entry) => sum + (entry.isWithdrawal ? -entry.amount : entry.amount),
    0n,
  );

  return total > 0n ? total : 0n;
}

/**
 * Current over target, as a fraction.
 *
 * Division through Number is safe here and only here: the result is a
 * proportion for a progress bar, and neither operand is used as money again
 * afterwards. Scaling first keeps the fraction meaningful for figures past
 * 2^53 — a goal in Rial passes that at 900 billion Toman, which a
 * property-buying goal reaches.
 */
function ratioOf(target: bigint, current: bigint): number {
  if (target <= 0n) return current > 0n ? 1 : 0;
  if (current >= target) return 1;

  const SCALE = 1_000_000n;

  return Number((current * SCALE) / target) / Number(SCALE);
}

/**
 * Whole months from one instant to another, counting the month in progress.
 *
 * Jalali months rather than 30-day blocks, because a goal due "in Esfand" is
 * due in Esfand however many days that leaves. The month containing `now`
 * counts as one: money can still go in this month.
 */
export function monthsUntil(
  target: Date,
  now: Date,
  monthOf: (instant: Date) => number,
): number {
  return Math.max(0, monthOf(target) - monthOf(now) + 1);
}

/**
 * Where a goal stands.
 *
 * `monthOf` turns an instant into an absolute Jalali month. It is passed in
 * rather than imported so this file stays pure arithmetic with no calendar
 * of its own — the caller supplies the one the application uses.
 */
export function goalProgress(
  goal: {
    targetAmount: bigint;
    targetDate: Date | null;
    contributions: ContributionInput[];
  },
  now: Date,
  monthOf: (instant: Date) => number,
): GoalProgress {
  const currentAmount = netContributed(goal.contributions);
  const isReached = currentAmount >= goal.targetAmount;
  const remainingAmount = isReached ? 0n : goal.targetAmount - currentAmount;

  const monthsRemaining = goal.targetDate
    ? monthsUntil(goal.targetDate, now, monthOf)
    : null;

  return {
    targetAmount: goal.targetAmount,
    currentAmount,
    remainingAmount,
    ratio: ratioOf(goal.targetAmount, currentAmount),
    isReached,
    monthsRemaining,
    monthlyContribution: requiredMonthly(remainingAmount, monthsRemaining),
    state: isReached
      ? "REACHED"
      : monthsRemaining !== null && monthsRemaining <= 0
        ? "OVERDUE"
        : "IN_PROGRESS",
  };
}

/**
 * What has to go in each month, rounded **up**.
 *
 * Up rather than to nearest: rounding down leaves the goal a Rial short on
 * its own deadline, which is the one month the figure exists to prevent.
 *
 * A goal whose date has passed and is not reached has no months left to
 * spread over, so the whole remainder is what it needs — now, not per month.
 */
function requiredMonthly(remaining: bigint, months: number | null): bigint | null {
  if (months === null) return null;
  if (remaining === 0n) return 0n;
  if (months <= 0) return remaining;

  const divisor = BigInt(months);

  return (remaining + divisor - 1n) / divisor;
}
