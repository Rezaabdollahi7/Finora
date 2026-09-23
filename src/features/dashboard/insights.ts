import { siteConfig } from "@/config/site";
import { calendarDaysBetween } from "@/utils/date";
import { absBigInt } from "@/utils/money";
import type { DashboardTotals } from "@/features/dashboard/types";

/**
 * The derived figures the dashboard draws, computed from the summary it
 * already has. Pure, so every rule here is tested without a database.
 *
 * Money stays bigint from end to end (rule G.2). The only floats are
 * ratios — a share of a bar, a percentage beside a figure — which are
 * display values: the amounts they sit next to are formatted from the
 * original bigints, never from a ratio multiplied back out.
 */

/** A ratio of two Rial amounts, for display. 0 when the whole is 0. */
export function ratioOf(part: bigint, whole: bigint): number {
  if (whole === 0n) return 0;

  // Scale before converting so a ratio of two large amounts keeps its
  // precision: both sides are well past 2^53 for a household's net worth
  // in Rial, but their quotient in parts per million is not.
  return Number((part * 1_000_000n) / whole) / 1_000_000;
}

/* ------------------------------------------------------------------ */
/* Month-over-month change                                             */
/* ------------------------------------------------------------------ */

export type Change = { direction: "up" | "down" | "flat"; ratio: number };

/**
 * Month-over-month change.
 *
 * Returns null when there is nothing honest to say: with no figure last
 * month there is no percentage, and "∞٪ رشد" is noise rather than
 * information.
 */
export function monthOverMonth(value: string, previous: string): Change | null {
  const now = BigInt(value);
  const before = BigInt(previous);

  if (before === 0n) return null;

  const delta = now - before;
  if (delta === 0n) return { direction: "flat", ratio: 0 };

  return {
    direction: delta > 0n ? "up" : "down",
    ratio: ratioOf(absBigInt(delta), absBigInt(before)),
  };
}

/**
 * Whether a change is good news. Spending less is an improvement, earning
 * less is not, so colouring by direction alone would call a fall in
 * expenses a bad month. Null when direction carries no judgement.
 */
export function isGoodChange(
  change: Change,
  goodWhen: "up" | "down" | "either",
): boolean | null {
  if (goodWhen === "either" || change.direction === "flat") return null;
  return (change.direction === "up") === (goodWhen === "up");
}

/* ------------------------------------------------------------------ */
/* Where this month's income went                                      */
/* ------------------------------------------------------------------ */

export type IncomeSplit =
  /** Nothing earned and nothing spent: there is no bar to draw. */
  | { kind: "empty" }
  /** Spent without earning: the whole month is a deficit. */
  | { kind: "no-income"; expenses: bigint }
  /** Earned at least as much as was spent. Shares sum to 1. */
  | { kind: "surplus"; expenseShare: number; savingsShare: number }
  /** Spent more than was earned. `overspend` is the excess as a share of income. */
  | { kind: "deficit"; overspend: number; deficit: bigint };

export function incomeSplit(income: string, expenses: string): IncomeSplit {
  const earned = BigInt(income);
  const spent = BigInt(expenses);

  if (earned <= 0n) {
    return spent > 0n ? { kind: "no-income", expenses: spent } : { kind: "empty" };
  }

  if (spent > earned) {
    const deficit = spent - earned;
    return { kind: "deficit", overspend: ratioOf(deficit, earned), deficit };
  }

  const expenseShare = ratioOf(spent, earned);

  return { kind: "surplus", expenseShare, savingsShare: 1 - expenseShare };
}

/* ------------------------------------------------------------------ */
/* How far into the month, and how much is left per day                */
/* ------------------------------------------------------------------ */

export type MonthPace = {
  /** Today's day of the month, 1-based. */
  day: number;
  /** Days in this Jalali month. */
  length: number;
  /** Days left including today, so it is never 0 inside the month. */
  remainingDays: number;
  /** day / length, for the dial. */
  progress: number;
  /** This month's income minus expenses so far. */
  left: bigint;
  /** `left` spread over the remaining days, in whole Toman (as Rial); 0 when nothing is left. */
  perDay: bigint;
};

/**
 * The month's pace, for the dial that mirrors the reference boards' time
 * tracker: which day of the Jalali month it is, and how much of what the
 * household has kept so far it could spend each remaining day and still end
 * the month even.
 *
 * Days are counted on the household's calendar (Asia/Tehran), so the first
 * of Mehr is day 1 from local midnight, not from midnight UTC. The daily
 * figure divides bigints and rounds down to a whole Toman — never up, and
 * never to a fraction the screen would show as "1,415,333.3".
 */
const TOMAN = siteConfig.currency.rialPerToman;

export function monthPace(
  period: { start: string; end: string },
  savings: string,
  now: Date = new Date(),
): MonthPace {
  const start = new Date(period.start);
  const length = Math.max(1, calendarDaysBetween(start, new Date(period.end)));
  const day = Math.min(length, Math.max(1, calendarDaysBetween(start, now) + 1));
  const remainingDays = length - day + 1;
  const left = BigInt(savings);

  return {
    day,
    length,
    remainingDays,
    progress: day / length,
    left,
    perDay: left > 0n ? (left / BigInt(remainingDays) / TOMAN) * TOMAN : 0n,
  };
}

/* ------------------------------------------------------------------ */
/* What net worth is made of                                           */
/* ------------------------------------------------------------------ */

export type NetWorthComposition = {
  /** Account balances, clamped at 0 for the bar: an overdraft owns no share. */
  balance: bigint;
  assets: bigint;
  liabilities: bigint;
  /** balance + assets: the length of the "what we have" bar. */
  gross: bigint;
  /** Shares of `gross`. */
  balanceShare: number;
  assetShare: number;
  /** Liabilities as a share of `gross`, capped at 1 for drawing. */
  liabilityShare: number;
};

export function netWorthComposition(totals: DashboardTotals): NetWorthComposition {
  const balanceRaw = BigInt(totals.totalBalance);
  const balance = balanceRaw > 0n ? balanceRaw : 0n;
  const assets = BigInt(totals.assetValue);
  const liabilities = BigInt(totals.liabilityValue);
  const gross = balance + assets;

  return {
    balance,
    assets,
    liabilities,
    gross,
    balanceShare: ratioOf(balance, gross),
    assetShare: ratioOf(assets, gross),
    liabilityShare:
      gross === 0n
        ? liabilities > 0n
          ? 1
          : 0
        : Math.min(1, ratioOf(liabilities, gross)),
  };
}

/* ------------------------------------------------------------------ */
/* Drawing shares                                                      */
/* ------------------------------------------------------------------ */

/**
 * Widths, in percent, for the segments of a stacked bar.
 *
 * A real but tiny share still gets `minPercent` so it can be seen and
 * hovered, and the others give up the difference in proportion so the bar
 * never overflows. Zero shares stay zero: an empty segment is not drawn.
 */
export function segmentWidths(shares: number[], minPercent = 2): number[] {
  const positive = shares.map((share) => (share > 0 ? share : 0));
  const total = positive.reduce((sum, share) => sum + share, 0);
  if (total === 0) return positive.map(() => 0);

  const raw = positive.map((share) => (share / total) * 100);
  const small = raw.filter((width) => width > 0 && width < minPercent);
  if (small.length === 0) return raw;

  const reserved = small.length * minPercent;
  const largeTotal = raw.reduce(
    (sum, width) => (width >= minPercent ? sum + width : sum),
    0,
  );
  const scale = largeTotal > 0 ? (100 - reserved) / largeTotal : 0;

  return raw.map((width) =>
    width === 0 ? 0 : width < minPercent ? minPercent : width * scale,
  );
}
