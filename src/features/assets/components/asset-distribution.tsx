"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import {
  CHART,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import { formatPercent } from "@/utils/number";
import type { AssetTypeShare } from "@/features/assets/types";

/**
 * How the portfolio splits across kinds of asset (task 3.7).
 *
 * Horizontal bars for the same reason the expense chart uses them: the
 * reader's job is to compare magnitudes, and a bar's length is read far more
 * accurately than a slice's angle. Horizontal, because "سرمایه‌گذاری" does
 * not fit under a vertical column.
 *
 * Each kind of asset is an identity, so it takes a categorical hue in the
 * validated order (docs §0.6), the same palette as the dashboard's expense
 * donut. Past six kinds the rest share the neutral rather than inventing
 * hues no reader with colour vision deficiency could tell apart; the list
 * under the chart names every row with its exact value either way.
 */

/** `plot` is the chart's numeric axis value; `value` stays the exact Rial. */
type Row = AssetTypeShare & { plot: number; color: string };

function toPlot(shares: AssetTypeShare[]): Row[] {
  return shares.map((share, index) => ({
    ...share,
    plot: Number(share.value),
    color: CHART.categorical[index] ?? CHART.neutral,
  }));
}

export function AssetDistribution({ shares }: { shares: AssetTypeShare[] }) {
  const data = toPlot(shares);

  if (data.length === 0) return null;

  return (
    <Card variant="featured" className="reveal gap-6 p-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>ترکیب دارایی‌ها</CardTitle>
          <CardDescription>سهم هر نوع از ارزش کل سبد</CardDescription>
        </div>
      </CardHeader>

      <div
        className="w-full"
        dir="ltr"
        style={{ height: `${Math.max(180, data.length * 44 + 16)}px` }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
            barCategoryGap={12}
          >
            {/*
              Reversed so bars grow from the right, where their names are,
              toward the left. Left-anchored bars strand a short one at the
              far edge, away from the label it belongs to (rule G.6).
            */}
            <XAxis
              type="number"
              hide
              reversed
              domain={[0, "dataMax"]}
              tickFormatter={(value: number) => compactToman(BigInt(Math.round(value)))}
            />
            <YAxis
              type="category"
              dataKey="label"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={80}
              tick={{
                fill: "var(--foreground)",
                fontSize: 13,
                fontFamily: "inherit",
                textAnchor: "start",
              }}
              tickMargin={12}
            />
            <Tooltip
              cursor={{ fill: "var(--primary-subtle)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const row = payload[0]?.payload as Row | undefined;
                if (!row) return null;

                return (
                  <ChartTooltip
                    title={row.label}
                    rows={[{ label: "ارزش", rial: row.value, color: row.color }]}
                  />
                );
              }}
            />
            {/* Pills, as on the dashboard: both ends rounded. */}
            <Bar dataKey="plot" radius={9} maxBarSize={18}>
              {data.map((row) => (
                <Cell key={row.type} fill={row.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/*
        The figures, in full. The chart shows proportion; this is where the
        exact amount lives, which is also the non-colour relief the lighter
        steps of the ramp need (§59.3).
      */}
      <ul className="space-y-2">
        {data.map((row) => (
          <li key={row.type} className="flex items-center gap-3 text-body">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span
              className="tabular ms-auto shrink-0 text-caption text-text-muted"
              dir="ltr"
            >
              {formatPercent(row.share, { fractionDigits: 0 })}
            </span>
            <Money rial={row.value} className="shrink-0 font-medium" unit={false} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
