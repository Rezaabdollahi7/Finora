/**
 * Report arithmetic (tasks 8.1–8.8).
 *
 * No database and no calendar: every figure arrives already gathered. The
 * parts worth isolating here are the ones a reader will want to argue with —
 * what a savings rate is when income is zero, what counts as a debt payment,
 * and how a month-on-month change reads when the earlier month was nothing.
 */

/**
 * The savings rate, as a fraction (task 8.4).
 *
 * `savings / income`, and deliberately **null** rather than zero when there
 * was no income. A household that earned nothing and spent nothing did not
 * save 0% of anything; printing "۰٪" would invent a fact, and printing
 * "−∞٪" for a month that spent from savings would be worse.
 *
 * Division through Number is safe here and only here: the result is a
 * proportion for display, and neither operand is used as money afterwards.
 * Scaling first keeps it meaningful past 2^53.
 */
export function savingsRate(income: bigint, savings: bigint): number | null {
  if (income <= 0n) return null;

  const SCALE = 1_000_000n;

  return Number((savings * SCALE) / income) / Number(SCALE);
}

/**
 * How one figure moved against another (task 8.7).
 *
 * The absolute change is always meaningful; the ratio is not. Going from
 * nothing to something is not an infinite improvement, it is a number with
 * no previous to divide by, so `ratio` is null there rather than Infinity —
 * which JSON cannot carry anyway (`JSON.stringify(Infinity)` is `null`).
 */
export type Change = {
  current: bigint;
  previous: bigint;
  amount: bigint;
  ratio: number | null;
};

export function change(current: bigint, previous: bigint): Change {
  const amount = current - previous;

  if (previous === 0n) return { current, previous, amount, ratio: null };

  const SCALE = 1_000_000n;
  // Against the magnitude of the previous figure: a debt falling from −100
  // to −50 is a 50% improvement, not a −50% one.
  const base = previous < 0n ? -previous : previous;

  return {
    current,
    previous,
    amount,
    ratio: Number((amount * SCALE) / base) / Number(SCALE),
  };
}

/** One row of a breakdown: a named bucket and what it came to. */
export type Bucket = {
  key: string;
  label: string;
  amount: bigint;
};

/**
 * Order a breakdown largest first, with a stable tie-break.
 *
 * Sorting by amount alone leaves two equal buckets in whatever order the
 * database happened to return, which makes a report that changes between
 * refreshes without the data changing. The label decides ties.
 */
export function rank(buckets: Bucket[]): Bucket[] {
  return [...buckets].sort((a, b) => {
    if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
    return a.label.localeCompare(b.label, "fa");
  });
}

/**
 * Each bucket's share of the total, as a fraction.
 *
 * Shares are computed against the sum of the buckets rather than against a
 * total passed in, so they always add to one. A total that disagreed with
 * its own parts would produce shares that did not.
 */
export function shares(buckets: Bucket[]): (Bucket & { share: number })[] {
  const total = buckets.reduce((sum, bucket) => sum + bucket.amount, 0n);

  if (total <= 0n) return buckets.map((bucket) => ({ ...bucket, share: 0 }));

  const SCALE = 1_000_000n;

  return buckets.map((bucket) => ({
    ...bucket,
    share: Number((bucket.amount * SCALE) / total) / Number(SCALE),
  }));
}

/**
 * A plain observation about a category, never a judgement (task 8.8).
 *
 * The roadmap asks for factual observations rather than subjective financial
 * scores, and this is where that is enforced: the shapes below carry numbers
 * and a direction, and nothing carries a grade, a rating, or an adjective.
 * Whether spending more on food than last month is good is not something a
 * ledger can know.
 */
export const TREND_DIRECTIONS = ["UP", "DOWN", "FLAT"] as const;

export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

/**
 * Which way a figure moved, with a dead band.
 *
 * Under a twentieth either way is reported as flat. Without it, a household
 * whose grocery bill moved by a thousand Toman would see an arrow every
 * month and learn to ignore all of them.
 */
export const TREND_DEAD_BAND = 0.05;

export function trend(current: bigint, previous: bigint): TrendDirection {
  if (previous === 0n) return current === 0n ? "FLAT" : "UP";

  const moved = change(current, previous).ratio;

  if (moved === null || Math.abs(moved) < TREND_DEAD_BAND) return "FLAT";

  return moved > 0 ? "UP" : "DOWN";
}
