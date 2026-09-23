"use client";

import { cn } from "@/lib/utils";
import { formatToman } from "@/utils/money";

/**
 * Shared chart furniture (design system §59.4): the tooltip and the legend.
 * The tokens they draw with live in chart-tokens.ts and are re-exported
 * here, so client charts keep one import.
 */
export { AXIS_TICK, CHART, compactToman } from "@/components/charts/chart-tokens";

export type TooltipRow = { label: string; rial: string; color?: string };

/**
 * Tooltip surface, styled from the design tokens rather than Recharts'
 * defaults: the ink pill of the reference boards, so it reads the same on
 * every card in both themes. Values are exact — the axis is where rounding
 * is allowed.
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
        "rounded-md bg-ink-surface px-3.5 py-2.5 text-ink-surface-foreground shadow-floating",
        className,
      )}
    >
      <p className="mb-2 text-caption font-semibold">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3 text-caption">
            {row.color ? (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full ring-2 ring-ink-surface-subtle"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="text-ink-surface-muted">{row.label}</span>
            <span className="tabular ms-auto font-medium" dir="ltr">
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
