"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS_TICK,
  CHART,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import type { ForecastPointDto } from "@/features/forecast/types";

/**
 * Projected liquidity, month by month (task 6.8).
 *
 * A single series, so no legend: the title already says what is plotted
 * (§59.3). An area under the line, at the wash opacity of §59.4, because the
 * quantity is a level rather than a rate — the filled space reads as "how
 * much there is", the same reasoning as the net-worth chart.
 *
 * A zero line is drawn whenever the projection crosses it. On a chart whose
 * whole purpose is to show the household running out of money, the axis
 * baseline floats wherever the data puts it, and without the rule there is
 * nothing to say which side of nothing a point is on.
 */
export function ForecastChart({
  points,
  openingBalance,
}: {
  points: ForecastPointDto[];
  /** Today's spendable balance, plotted as the point the projection leaves. */
  openingBalance: string;
}) {
  // The opening balance is a real observation, not a projection, and starting
  // the line at the first month's close would hide the step the household is
  // about to take.
  const data = [
    {
      month: 0,
      label: "اکنون",
      closingBalance: openingBalance,
      isShortfall: BigInt(openingBalance) < 0n,
      value: Number(BigInt(openingBalance) / 10n),
    },
    ...points.map((point) => ({
      ...point,
      value: Number(BigInt(point.closingBalance) / 10n),
    })),
  ];

  const crossesZero = data.some((point) => point.value < 0);

  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="forecastWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.savings} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART.savings} stopOpacity={0.02} />
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
            minTickGap={16}
          />
          <YAxis
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
            tickMargin={8}
            width={56}
            tickFormatter={(value: number) =>
              compactToman(BigInt(Math.round(value)) * 10n)
            }
          />
          {crossesZero ? (
            <ReferenceLine y={0} stroke={CHART.expense} strokeDasharray="4 4" />
          ) : null}
          <Tooltip
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;

              const point = payload[0]?.payload as
                (ForecastPointDto & { label: string }) | undefined;
              if (!point) return null;

              return (
                <ChartTooltip
                  title={point.label}
                  rows={[
                    {
                      label: "موجودی پایان ماه",
                      rial: point.closingBalance,
                      color: point.isShortfall ? CHART.expense : CHART.savings,
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
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="url(#forecastWash)"
            dot={false}
            activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
