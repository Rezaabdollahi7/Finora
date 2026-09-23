/**
 * Chart tokens (design system §0.6 and §59.4).
 *
 * A plain module rather than part of chart-primitives.tsx, which is a
 * client module: a server component importing a value from a "use client"
 * file receives a client reference instead of the value, so the colours
 * have to live somewhere both sides can read.
 *
 * Recharts is given colours as CSS variables, so a chart follows the theme
 * without re-rendering: `var(--chart-income)` resolves per theme at paint
 * time. Nothing here reads a hex value.
 */

export const CHART = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  savings: "var(--chart-savings)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  /** Opaque, because it rings markers that sit on top of other marks. */
  surface: "var(--card-solid)",
  neutral: "var(--chart-neutral)",
  /**
   * Categorical hues for identity, in their validated order: blue, orange,
   * cyan, yellow, violet, green (docs §0.6). Assigned in sequence, never
   * cycled — a seventh series folds into "سایر" with `neutral`.
   */
  categorical: [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
  ],
  /** Sequential ramp, largest first. */
  sequential: [
    "var(--chart-seq-1)",
    "var(--chart-seq-2)",
    "var(--chart-seq-3)",
    "var(--chart-seq-4)",
    "var(--chart-seq-5)",
    "var(--chart-seq-6)",
  ],
} as const;

export const AXIS_TICK = {
  fill: CHART.axis,
  fontSize: 12,
  fontFamily: "inherit",
} as const;

/**
 * Compact money for an axis tick, where a full figure would not fit.
 *
 * Takes Rial and shows Toman in Persian magnitude words, so "۱۲ م" reads as
 * twelve million Toman. Axis ticks are context; the exact figure is always in
 * the tooltip and the table.
 */
export function compactToman(rial: string | number | bigint): string {
  const toman = BigInt(rial) / 10n;
  const abs = toman < 0n ? -toman : toman;
  const sign = toman < 0n ? "−" : "";

  const scale = (divisor: bigint, unit: string) => {
    const whole = abs / divisor;
    const tenth = ((abs % divisor) * 10n) / divisor;
    const body = tenth === 0n ? `${whole}` : `${whole}٫${tenth}`;
    return `${sign}${body} ${unit}`;
  };

  if (abs >= 1_000_000_000n) return scale(1_000_000_000n, "می");
  if (abs >= 1_000_000n) return scale(1_000_000n, "م");
  if (abs >= 1_000n) return scale(1_000n, "ه");

  return `${sign}${abs}`;
}
