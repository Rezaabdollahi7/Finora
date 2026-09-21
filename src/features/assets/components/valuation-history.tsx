"use client";

import { History } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import {
  AXIS_TICK,
  CHART,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import { formatJalaliDate, formatTime } from "@/utils/date";
import { formatQuantity } from "@/utils/quantity";
import type { AssetDto, AssetValuationDto } from "@/features/assets/types";

/**
 * What this asset has been worth, over time (task 3.8).
 *
 * The chart is the evidence that re-pricing appends rather than overwrites:
 * every point on it is a row that a later price did not touch.
 *
 * A step line rather than a smooth curve, because a recorded price holds
 * until the next one is recorded — an interpolated slope between two entries
 * would draw values nobody ever observed.
 *
 * The x-axis is time, not the row number. Category spacing would put a
 * six-month gap and a one-day gap the same distance apart, which reads as a
 * price that moved steadily when it did not; it would also merge two prices
 * recorded on one day into a single category and break the line between
 * them.
 */

/**
 * Minimum space between two date labels, in pixels.
 *
 * Every recorded instant is offered as a tick and Recharts drops the ones
 * that would not fit. Thinning by index instead would put two labels on top
 * of each other whenever two prices were recorded close together — which is
 * exactly what a busy week looks like — and it would behave differently at
 * every screen width.
 */
const MIN_TICK_GAP = 56;

export function ValuationHistory({
  asset,
  valuations,
}: {
  asset: AssetDto;
  valuations: AssetValuationDto[];
}) {
  // A day with more than one entry shows the time as well, or two corrections
  // of the same price would be indistinguishable rows.
  const perDay = new Map<string, number>();
  for (const row of valuations) {
    const day = formatJalaliDate(new Date(row.asOf), { style: "long" });
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const data = valuations.map((row) => {
    const at = new Date(row.asOf);
    const day = formatJalaliDate(at, { style: "long" });

    return {
      key: row.id,
      time: at.getTime(),
      when: (perDay.get(day) ?? 0) > 1 ? `${day} — ${formatTime(at)}` : day,
      value: Number(row.value),
      rial: row.value,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      source: row.source,
    };
  });

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>تاریخچهٔ ارزش</CardTitle>
          <CardDescription>
            هر قیمت ثبت‌شده یک رکورد جداگانه است و بازنویسی نمی‌شود.
          </CardDescription>
        </div>
      </CardHeader>

      {data.length < 2 ? (
        <EmptyState
          icon={History}
          title="هنوز فقط قیمت خرید ثبت شده"
          description="با ثبت قیمت روز، تغییر ارزش این دارایی از تاریخ خرید تا امروز اینجا رسم می‌شود."
        />
      ) : (
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="assetValueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.savings} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={CHART.savings} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              {/* Reversed: time runs right to left for an RTL reader (G.6). */}
              <XAxis
                type="number"
                dataKey="time"
                reversed
                domain={["dataMin", "dataMax"]}
                ticks={data.map((point) => point.time)}
                minTickGap={MIN_TICK_GAP}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickMargin={8}
                tickFormatter={(value: number) =>
                  formatJalaliDate(new Date(value), { style: "short" })
                }
              />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                width={64}
                tickFormatter={(value: number) =>
                  compactToman(BigInt(Math.round(value)))
                }
              />
              <Tooltip
                cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;

                  const point = payload[0]?.payload as
                    (typeof data)[number] | undefined;
                  if (!point) return null;

                  return (
                    <ChartTooltip
                      title={point.when}
                      rows={[
                        { label: "ارزش", rial: point.rial, color: CHART.savings },
                        { label: "قیمت واحد", rial: point.unitPrice },
                      ]}
                    />
                  );
                }}
              />
              {/*
                stepAfter holds each value from its own instant until the
                next one — which is what a recorded price does.
              */}
              <Area
                type="stepAfter"
                dataKey="value"
                stroke={CHART.savings}
                strokeWidth={2}
                fill="url(#assetValueFill)"
                dot={{ r: 3, fill: CHART.savings, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/*
        The rows themselves, newest first. The chart shows the shape; this is
        the record, and it is what makes "nothing was overwritten" checkable
        rather than merely stated.
      */}
      <ul className="divide-y divide-border">
        {[...data].reverse().map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
          >
            <span className="text-body text-muted-foreground">{row.when}</span>
            {row.source === "INITIAL" ? <Badge variant="outline">خرید</Badge> : null}
            <Money rial={row.rial} className="ms-auto font-medium" unit={false} />
            {asset.unit ? (
              <span className="flex w-full items-center gap-1 text-caption text-muted-foreground sm:basis-full sm:justify-end">
                {/*
                  The quantity is its own isolated run: a Latin number between
                  Persian words is reordered by the bidi algorithm, which
                  renders "18.5 گرم" as "گرم 18.5".
                */}
                <span className="tabular" dir="ltr">
                  {formatQuantity(BigInt(row.quantity))}
                </span>
                <span>{asset.unit}</span>
                <span aria-hidden>×</span>
                <Money rial={row.unitPrice} className="text-caption" unit={false} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
