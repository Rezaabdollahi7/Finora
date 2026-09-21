"use client";

import { TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import {
  AXIS_TICK,
  CHART,
  ChartLegend,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import type { CashFlowPoint } from "@/features/dashboard/types";

/**
 * Income, expenses and savings by Jalali month (task 2.3).
 *
 * Bars for the two measured quantities and a line for savings, which is
 * their difference: the same axis and the same unit, so this is a combo
 * rather than a second scale. Savings is the only series that can go
 * negative, and a line crossing the baseline shows that far better than a
 * bar does.
 *
 * Colours come from the validated cash-flow trio, not the semantic success
 * and danger steps — see docs/DESIGN_SYSTEM.md §59.1 for why.
 */

type Point = CashFlowPoint & {
  incomeValue: number;
  expenseValue: number;
  savingsValue: number;
};

/**
 * Recharts plots numbers, so the Rial bigints are converted for geometry
 * only. Every figure the reader sees — tooltip, legend total — is formatted
 * from the original string, so nothing displayed has been through a float.
 */
function toPlot(points: CashFlowPoint[]): Point[] {
  return points.map((point) => ({
    ...point,
    incomeValue: Number(point.income),
    expenseValue: Number(point.expenses),
    savingsValue: Number(point.savings),
  }));
}

const SERIES = [
  { key: "income", label: "درآمد", color: CHART.income },
  { key: "expenses", label: "هزینه", color: CHART.expense },
  { key: "savings", label: "پس‌انداز", color: CHART.savings },
] as const;

export function CashFlowChart({ points }: { points: CashFlowPoint[] }) {
  const data = toPlot(points);
  const hasData = data.some(
    (point) => point.incomeValue !== 0 || point.expenseValue !== 0,
  );

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>جریان نقدی</CardTitle>
          <CardDescription>درآمد، هزینه و پس‌انداز در شش ماه گذشته</CardDescription>
        </div>
      </CardHeader>

      {hasData ? (
        <>
          <ChartLegend items={SERIES.map(({ label, color }) => ({ label, color }))} />

          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                {/*
                  The axis is reversed and the values sit on the right, so the
                  timeline runs right-to-left like the rest of the interface
                  (rule G.6). The wrapper is dir="ltr" because Recharts
                  measures its own layout and mirrors incorrectly otherwise.
                */}
                <XAxis
                  dataKey="label"
                  reversed
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  tickMargin={8}
                />
                <YAxis
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS_TICK}
                  tickMargin={8}
                  width={56}
                  tickFormatter={(value: number) =>
                    compactToman(BigInt(Math.round(value)))
                  }
                />
                <Tooltip
                  cursor={{ fill: "var(--primary-subtle)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const point = payload[0]?.payload as Point | undefined;
                    if (!point) return null;

                    return (
                      <ChartTooltip
                        title={`${point.label} ${point.year}`}
                        rows={[
                          { label: "درآمد", rial: point.income, color: CHART.income },
                          {
                            label: "هزینه",
                            rial: point.expenses,
                            color: CHART.expense,
                          },
                          {
                            label: "پس‌انداز",
                            rial: point.savings,
                            color: CHART.savings,
                          },
                        ]}
                      />
                    );
                  }}
                />
                {/* 4px rounded data-end, square at the baseline (§59.4). */}
                <Bar
                  dataKey="incomeValue"
                  fill={CHART.income}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="expenseValue"
                  fill={CHART.expense}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
                <Line
                  type="monotone"
                  dataKey="savingsValue"
                  stroke={CHART.savings}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{
                    r: 4,
                    fill: CHART.savings,
                    stroke: CHART.surface,
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="هنوز داده‌ای برای نمودار نیست"
          description="با ثبت درآمد و هزینه، روند شش ماه گذشته اینجا نمایش داده می‌شود."
        />
      )}
    </Card>
  );
}
