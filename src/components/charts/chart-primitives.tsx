"use client";

import { cn } from "@/lib/utils";
import { formatToman } from "@/utils/money";

/**
 * Shared chart furniture (design system §59.4).
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
  surface: "var(--card)",
  neutral: "var(--chart-neutral)",
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

export type TooltipRow = { label: string; rial: string; color?: string };

/**
 * Tooltip surface, styled from the design tokens rather than Recharts'
 * defaults. Values are exact — the axis is where rounding is allowed.
 */
export function ChartTooltip({
  title,
  rows,
  className,
}: {
  title: string;
  rows: TooltipRow[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-popover px-3 py-2 shadow-md",
        className,
      )}
    >
      <p className="mb-2 text-caption font-semibold text-popover-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 text-caption">
            {row.color ? (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="text-muted-foreground">{row.label}</span>
            <span
              className="tabular ms-auto font-medium text-popover-foreground"
              dir="ltr"
            >
              {formatToman(BigInt(row.rial), { withUnit: false })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Legend for a chart with two or more series.
 *
 * Always rendered, so identity never depends on colour alone (§59.3). The
 * swatch carries the colour; the text stays in a text token.
 */
export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-4", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 text-caption text-muted-foreground"
        >
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
