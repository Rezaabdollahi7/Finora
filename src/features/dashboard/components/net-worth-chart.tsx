"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { SPRING_PILL } from "@/lib/motion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import {
  AXIS_TICK,
  CHART,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import {
  NET_WORTH_RANGES,
  NET_WORTH_RANGE_LABELS,
  type NetWorthPoint,
  type NetWorthRange,
} from "@/features/dashboard/types";

/**
 * Net worth over time (task 2.6).
 *
 * A single series, so no legend: the title already says what is plotted
 * (§59.3). An area under the line, at the wash opacity of §59.4, because the
 * quantity is a level rather than a rate — the filled space reads as "how
 * much there is".
 *
 * The range selector fetches from the API rather than slicing a preloaded
 * series: "all time" can be years, and shipping every point to the browser
 * so it can throw most of them away is what task 2.10 rules out. Its active
 * pill slides between ranges, the same shared-layout move as the sidebar.
 */
export function NetWorthChart({
  initialPoints,
  initialRange = "M6",
}: {
  initialPoints: NetWorthPoint[];
  initialRange?: NetWorthRange;
}) {
  const [range, setRange] = React.useState<NetWorthRange>(initialRange);
  const [points, setPoints] = React.useState(initialPoints);
  const [pending, setPending] = React.useState(false);

  async function selectRange(next: NetWorthRange) {
    setRange(next);
    setPending(true);

    try {
      const response = await fetch(`/api/dashboard/net-worth?range=${next}`);
      if (!response.ok) return;

      const payload = (await response.json()) as { points: NetWorthPoint[] };
      setPoints(payload.points);
    } finally {
      setPending(false);
    }
  }

  const data = points.map((point) => ({ ...point, value: Number(point.netWorth) }));
  const hasData = data.length > 1;

  return (
    <Card variant="featured" className="h-full gap-6 p-6">
      <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <CardTitle>روند ارزش خالص</CardTitle>
          <CardDescription>مجموع دارایی‌ها منهای بدهی‌ها در طول زمان</CardDescription>
        </div>
        <Tabs
          value={range}
          onValueChange={(value) => {
            void selectRange(value as NetWorthRange);
          }}
        >
          <LayoutGroup id="net-worth-range">
            <TabsList>
              {NET_WORTH_RANGES.map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    "relative isolate h-8 px-3 text-caption",
                    // The sliding pill below paints the active state.
                    "data-[state=active]:bg-transparent",
                  )}
                >
                  {range === value ? (
                    <motion.span
                      layoutId="range-pill"
                      aria-hidden
                      transition={SPRING_PILL}
                      className="absolute inset-0 -z-10 rounded-full bg-ink-surface"
                    />
                  ) : null}
                  <span
                    className={
                      range === value ? "text-ink-surface-foreground" : undefined
                    }
                  >
                    {NET_WORTH_RANGE_LABELS[value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </LayoutGroup>
        </Tabs>
      </CardHeader>

      {hasData ? (
        <div
          className="min-h-64 w-full flex-1 transition-opacity"
          dir="ltr"
          style={{ opacity: pending ? 0.6 : 1 }}
          aria-busy={pending}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="netWorthWash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.savings} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART.savings} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              {/* Time runs right to left, like the rest of the interface. */}
              <XAxis
                dataKey="label"
                reversed
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickMargin={8}
                minTickGap={24}
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
                cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;

                  const point = payload[0]?.payload as NetWorthPoint | undefined;
                  if (!point) return null;

                  return (
                    <ChartTooltip
                      title={point.label}
                      rows={[
                        {
                          label: "ارزش خالص",
                          rial: point.netWorth,
                          color: CHART.savings,
                        },
                      ]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={CHART.savings}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="url(#netWorthWash)"
                dot={false}
                animationDuration={1100}
                activeDot={{ r: 6, stroke: CHART.surface, strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          icon={Scale}
          title="هنوز تاریخچه‌ای نیست"
          description="با ثبت حساب و تراکنش، روند ارزش خالص شما اینجا شکل می‌گیرد."
        />
      )}
    </Card>
  );
}
