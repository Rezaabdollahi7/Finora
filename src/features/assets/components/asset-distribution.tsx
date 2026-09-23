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
 * One hue at descending steps rather than a colour per type. The data's job
 * here is magnitude, not identity — the axis label already says which type
 * each bar is — and eight distinct hues is more than any reader with a colour
 * vision deficiency could separate (design system §59.2, §59.3).
 */

/** `plot` is the chart's numeric axis value; `value` stays the exact Rial. */
type Row = AssetTypeShare & { plot: number; color: string };

function toPlot(shares: AssetTypeShare[]): Row[] {
  return shares.map((share, index) => ({
    ...share,
    plot: Number(share.value),
    color:
      CHART.sequential[Math.min(index, CHART.sequential.length - 1)] ?? CHART.neutral,
  }));
}

export function AssetDistribution({ shares }: { shares: AssetTypeShare[] }) {
  const data = toPlot(shares);

  if (data.length === 0) return null;

  return (
    <Card variant="featured" className="gap-6">
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
            {/* The rounded end is the data end, which is now on the left. */}
            <Bar dataKey="plot" radius={[4, 0, 0, 4]} maxBarSize={24}>
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
