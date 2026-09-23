"use client";

import * as React from "react";
import { PieChart as PieIcon } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";

import { cn } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { CHART, ChartTooltip } from "@/components/charts/chart-primitives";
import { formatPercent } from "@/utils/number";
import { sumRial } from "@/utils/money";
import { CardLink } from "@/features/dashboard/components/bento";
import type { CategoryExpense } from "@/features/dashboard/types";

/**
 * Where the month's money went (task 2.4).
 *
 * A donut, because the question is part-to-whole — "what share of the
 * month did each category take" — and each category is an identity, so it
 * takes a categorical hue in the validated order (docs §0.6). Past six the
 * tail folds into "سایر" in the neutral, rather than inventing a seventh
 * hue no one with colour vision deficiency could tell apart.
 *
 * The donut is never the only channel: the list beside it names every
 * slice with its exact amount and share. Hovering a slice lifts it out of
 * the ring; hovering either a slice or a row quiets the others.
 */

const MAX_SLICES = 6;

type Slice = CategoryExpense & { value: number; color: string };

function toPlot(slices: CategoryExpense[]): Slice[] {
  const head = slices.slice(0, MAX_SLICES - 1);
  const tail = slices.slice(MAX_SLICES - 1);

  const combined: CategoryExpense[] =
    tail.length > 1
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
      : slices;

  let hue = 0;
  return combined.map((slice) => ({
    ...slice,
    // Recharts measures geometry in numbers; every figure shown is
    // formatted from the original string.
    value: Number(slice.amount),
    // Uncategorised spending and the folded tail are an absence of
    // identity, not a category, so they sit outside the palette.
    color:
      slice.categoryId === null
        ? CHART.neutral
        : (CHART.categorical[hue++] ?? CHART.neutral),
  }));
}

/** The hovered slice, pulled out a little from the ring. */
function ActiveSlice(
  props: React.ComponentProps<typeof Sector> & { outerRadius?: number },
) {
  return <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 6} />;
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
  const [active, setActive] = React.useState<number | undefined>(undefined);

  return (
    <Card variant="featured" className="h-full gap-5 p-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>هزینه‌ها به تفکیک دسته</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
        </div>
        <CardLink href="/transactions" label="تراکنش‌ها" />
      </CardHeader>

      {data.length === 0 ? (
        <EmptyState
          icon={PieIcon}
          title="هزینه‌ای در این ماه ثبت نشده"
          description="با ثبت هزینه‌ها، سهم هر دسته از خرج ماه اینجا دیده می‌شود."
        />
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
          <div
            className="relative mx-auto aspect-square w-full max-w-52 shrink-0"
            dir="ltr"
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active: shown, payload }) => {
                    if (!shown || !payload?.length) return null;

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
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={3}
                  cornerRadius={8}
                  // Clockwise from the top: where a reader starts a clock.
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  animationDuration={1000}
                  activeShape={ActiveSlice}
                  onMouseEnter={(_, index) => {
                    setActive(index);
                  }}
                  onMouseLeave={() => {
                    setActive(undefined);
                  }}
                >
                  {data.map((slice, index) => (
                    <Cell
                      key={slice.name}
                      fill={slice.color}
                      // Hovering a row in the list quiets every other slice.
                      fillOpacity={active === undefined || active === index ? 1 : 0.3}
                      className="transition-[fill-opacity] duration-200"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              dir="rtl"
            >
              <span className="text-caption text-muted-foreground">جمع</span>
              <Money
                rial={total.toString()}
                className="text-h4 font-medium"
                unit={false}
              />
              <span className="text-caption text-muted-foreground">تومان</span>
            </div>
          </div>

          <ul className="flex min-w-0 flex-1 flex-col gap-1">
            {data.map((slice, index) => (
              <li
                key={slice.name}
                onMouseEnter={() => {
                  setActive(index);
                }}
                onMouseLeave={() => {
                  setActive(undefined);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 text-body transition-colors",
                  active === index && "bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate">{slice.name}</span>
                <span
                  className="tabular shrink-0 text-caption text-text-muted"
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
        </div>
      )}
    </Card>
  );
}
