"use client";

import { PieChart } from "lucide-react";
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
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import {
  CHART,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import { formatPercent } from "@/utils/number";
import { sumRial } from "@/utils/money";
import type { CategoryExpense } from "@/features/dashboard/types";

/**
 * Where the month's money went (task 2.4).
 *
 * Horizontal bars rather than a pie. The reader's job is to compare
 * magnitudes and see shares, and a bar's length is read far more accurately
 * than a slice's angle. Horizontal, because the category names are Persian
 * words that do not fit under a vertical column.
 *
 * One hue at descending steps rather than a colour per category: the data's
 * job here is magnitude, not identity, and the axis label already says which
 * category each bar is. That also avoids inventing a seventh and eighth hue
 * that no reader with colour vision deficiency could tell apart
 * (docs/DESIGN_SYSTEM.md §59.2, §59.3).
 */

/** Past this many bars the card stops being scannable; the tail folds up. */
const MAX_SLICES = 7;

type Slice = CategoryExpense & { value: number; color: string };

function toPlot(slices: CategoryExpense[]): Slice[] {
  const head = slices.slice(0, MAX_SLICES);
  const tail = slices.slice(MAX_SLICES);

  const combined: CategoryExpense[] =
    tail.length > 0
      ? [
          ...head,
          {
            categoryId: null,
            name: "سایر",
            icon: null,
            amount: sumRial(tail.map((slice) => BigInt(slice.amount))).toString(),
            share: tail.reduce((sum, slice) => sum + slice.share, 0),
          },
        ]
      : head;

  return combined.map((slice, index) => ({
    ...slice,
    value: Number(slice.amount),
    // Uncategorised spending is an absence of data, not a category, so it
    // sits outside the ramp.
    color:
      slice.categoryId === null
        ? CHART.neutral
        : (CHART.sequential[Math.min(index, CHART.sequential.length - 1)] ??
          CHART.neutral),
  }));
}

export function ExpenseCategoryChart({
  slices,
  periodLabel,
}: {
  slices: CategoryExpense[];
  periodLabel: string;
}) {
  const data = toPlot(slices);
  const total = sumRial(data.map((slice) => BigInt(slice.amount)));

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>هزینه‌ها به تفکیک دسته</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </div>
        {data.length > 0 ? (
          <div className="text-end">
            <Money rial={total.toString()} className="text-h3 font-bold" unit={false} />
            <p className="text-caption text-muted-foreground">تومان</p>
          </div>
        ) : null}
      </CardHeader>

      {data.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="هزینه‌ای در این ماه ثبت نشده"
          description="با ثبت هزینه‌ها، سهم هر دسته از خرج ماه اینجا دیده می‌شود."
        />
      ) : (
        <>
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
                  Reversed so bars grow from the right, where their names
                  are, toward the left. Left-anchored bars strand a short
                  one at the far edge, far from the label it belongs to
                  (rule G.6).
                */}
                <XAxis
                  type="number"
                  hide
                  reversed
                  domain={[0, "dataMax"]}
                  tickFormatter={(value: number) =>
                    compactToman(BigInt(Math.round(value)))
                  }
                />
                {/* Names sit on the right, where an RTL reader starts. */}
                <YAxis
                  type="category"
                  dataKey="name"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={96}
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

                    const slice = payload[0]?.payload as Slice | undefined;
                    if (!slice) return null;

                    return (
                      <ChartTooltip
                        title={slice.name}
                        rows={[
                          { label: "هزینه", rial: slice.amount, color: slice.color },
                        ]}
                      />
                    );
                  }}
                />
                {/* The rounded end is the data end, which is now on the left. */}
                <Bar dataKey="value" radius={[4, 0, 0, 4]} maxBarSize={24}>
                  {data.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/*
            The figures, in full. The chart shows proportion; this is where
            the exact amount lives, which is also the relief the palette
            validator's contrast warning requires for the lighter steps.
          */}
          <ul className="space-y-2">
            {data.map((slice) => (
              <li key={slice.name} className="flex items-center gap-3 text-body">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate text-muted-foreground">{slice.name}</span>
                <span
                  className="tabular ms-auto shrink-0 text-caption text-text-muted"
                  dir="ltr"
                >
                  {formatPercent(slice.share, { fractionDigits: 0 })}
                </span>
                <Money
                  rial={slice.amount}
                  className="shrink-0 font-medium"
                  unit={false}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
