"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { formatPercent } from "@/utils/number";
import {
  AXIS_TICK,
  CHART,
  ChartTooltip,
  compactToman,
} from "@/components/charts/chart-primitives";
import type { TrendDirection } from "@/features/reports/reporting";
import type { BucketDto, ReportsDto } from "@/features/reports/types";

/** A direction, never a judgement (task 8.8). */
const TREND_STYLE: Record<
  TrendDirection,
  { icon: LucideIcon; className: string; short: string; label: string }
> = {
  UP: {
    icon: ArrowUp,
    className: "text-danger",
    short: "بیشتر",
    label: "بیشتر از ماه قبل",
  },
  DOWN: {
    icon: ArrowDown,
    className: "text-success",
    short: "کمتر",
    label: "کمتر از ماه قبل",
  },
  FLAT: {
    icon: ArrowRight,
    className: "text-muted-foreground",
    short: "ثابت",
    label: "تقریباً ثابت",
  },
};

export function Figure({
  label,
  rial,
  hint,
  tone,
}: {
  label: string;
  rial: string;
  hint?: string;
  tone?: "danger" | "success";
}) {
  return (
    <div className="space-y-1">
      <span className="text-caption text-muted-foreground">{label}</span>
      <Money
        rial={rial}
        className={cn(
          "block text-h3 font-light",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
        )}
      />
      {hint ? <span className="text-caption text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** A ranked breakdown as a table; the shares make the ranking readable. */
export function BucketTable({
  title,
  description,
  buckets,
  emptyTitle,
}: {
  title: string;
  description: string;
  buckets: BucketDto[];
  emptyTitle: string;
}) {
  return (
    <Card variant="featured" className="gap-4">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>

      {buckets.length === 0 ? (
        <p className="py-6 text-center text-body text-muted-foreground">{emptyTitle}</p>
      ) : (
        <div className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 z-10 bg-card">عنوان</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>سهم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((bucket) => (
                <TableRow key={bucket.key}>
                  <TableCell className="sticky start-0 z-10 bg-card whitespace-nowrap">
                    {bucket.label}
                  </TableCell>
                  <TableCell>
                    <Money rial={bucket.amount} unit={false} />
                  </TableCell>
                  <TableCell className="tabular" dir="ltr">
                    {formatPercent(bucket.share, { fractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

/** Income against spending, month by month (tasks 8.2–8.4). */
export function CashFlowSection({ reports }: { reports: ReportsDto }) {
  const data = reports.series.map((point) => ({
    ...point,
    incomeValue: Number(BigInt(point.income) / 10n),
    expenseValue: Number(BigInt(point.expenses) / 10n),
  }));

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>درآمد و هزینه</CardTitle>
          <CardDescription>
            هر ماه از {reports.from.label} تا {reports.to.label}
          </CardDescription>
        </div>
      </CardHeader>

      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
            <Tooltip
              cursor={{ fill: CHART.grid, fillOpacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as (typeof data)[number] | undefined;
                if (!point) return null;

                return (
                  <ChartTooltip
                    title={point.label}
                    rows={[
                      { label: "درآمد", rial: point.income, color: CHART.income },
                      { label: "هزینه", rial: point.expenses, color: CHART.expense },
                      { label: "پس‌انداز", rial: point.savings },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="incomeValue" fill={CHART.income} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenseValue" fill={CHART.expense} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Net worth over the range (task 8.7). */
export function NetWorthSection({ reports }: { reports: ReportsDto }) {
  const data = reports.netWorth.history.map((point) => ({
    ...point,
    numeric: Number(BigInt(point.value) / 10n),
  }));

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>ارزش خالص</CardTitle>
          <CardDescription>دارایی‌ها منهای بدهی‌ها، در پایان هر ماه</CardDescription>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Figure label="دارایی‌ها" rial={reports.netWorth.assets} />
        <Figure label="بدهی‌ها" rial={reports.netWorth.liabilities} tone="danger" />
        <Figure
          label="ارزش خالص"
          rial={reports.netWorth.netWorth.current}
          hint={
            reports.netWorth.netWorth.ratio === null
              ? undefined
              : `${formatPercent(reports.netWorth.netWorth.ratio, { fractionDigits: 1 })} نسبت به ماه قبل`
          }
        />
      </div>

      <div className="h-56 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
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
            <Tooltip
              cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0]?.payload as (typeof data)[number] | undefined;
                if (!point) return null;

                return (
                  <ChartTooltip
                    title={point.label}
                    rows={[
                      {
                        label: "ارزش خالص",
                        rial: point.value,
                        color: CHART.savings,
                      },
                    ]}
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="numeric"
              stroke={CHART.savings}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Assets: allocation, profit and the largest holdings (task 8.6). */
export function AssetSection({ reports }: { reports: ReportsDto }) {
  const { assets } = reports;
  const profit = BigInt(assets.profitAndLoss);

  return (
    <div className="space-y-6">
      <Card variant="featured" className="gap-6">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>دارایی‌ها</CardTitle>
            <CardDescription>ارزش امروز در برابر بهای خرید</CardDescription>
          </div>
        </CardHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <Figure label="ارزش کل" rial={assets.totalValue} />
          <Figure label="بهای خرید" rial={assets.totalCost} />
          <Figure
            label={profit < 0n ? "زیان" : "سود"}
            rial={profit < 0n ? (-profit).toString() : assets.profitAndLoss}
            tone={profit < 0n ? "danger" : "success"}
          />
        </div>

        {assets.largest.length === 0 ? (
          <EmptyState
            icon={ArrowRight}
            title="دارایی‌ای ثبت نشده است"
            description="با ثبت طلا، ارز، خودرو یا ملک، ترکیب و سود دارایی‌ها اینجا دیده می‌شود."
          />
        ) : (
          <div className="min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky start-0 z-10 bg-card">
                    بزرگ‌ترین دارایی‌ها
                  </TableHead>
                  <TableHead>ارزش</TableHead>
                  <TableHead>سهم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.largest.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell className="sticky start-0 z-10 bg-card whitespace-nowrap">
                      {asset.name}
                    </TableCell>
                    <TableCell>
                      <Money rial={asset.value} unit={false} />
                    </TableCell>
                    <TableCell className="tabular" dir="ltr">
                      {formatPercent(asset.share, { fractionDigits: 0 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <BucketTable
        title="ترکیب دارایی‌ها"
        description="ارزش امروز به تفکیک نوع"
        buckets={assets.allocation}
        emptyTitle="دارایی‌ای برای تفکیک نیست."
      />
    </div>
  );
}

/** Debt: what was borrowed, paid, owed, and what falls due next (task 8.5). */
export function DebtSection({ reports }: { reports: ReportsDto }) {
  const { debt } = reports;

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>بدهی‌ها</CardTitle>
          <CardDescription>وام‌های در جریان و اقساط پیش‌رو</CardDescription>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure label="مبلغ وام‌ها" rial={debt.originalDebt} hint="اصل وام، بدون سود" />
        <Figure label="بازپرداخت‌شده" rial={debt.paidDebt} tone="success" />
        {/*
          The remainder can exceed the principal, and that is arithmetic
          rather than a bug: what is still owed is the unpaid instalments,
          which carry the interest. Saying so here stops the two figures
          looking like they contradict each other.
        */}
        <Figure
          label="مانده بدهی"
          rial={debt.remainingDebt}
          tone="danger"
          hint="اقساط پرداخت‌نشده، با احتساب سود"
        />
        <Figure
          label="قسط ماهانه"
          rial={debt.monthlyBurden}
          hint="مجموع اقساط وام‌های در جریان"
        />
      </div>

      {debt.upcoming.length === 0 ? (
        <p className="py-6 text-center text-body text-muted-foreground">
          قسطی در پیش نیست.
        </p>
      ) : (
        <div className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 z-10 bg-card">وام</TableHead>
                <TableHead>قسط</TableHead>
                <TableHead>سررسید</TableHead>
                <TableHead>مبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debt.upcoming.map((installment) => (
                <TableRow key={`${installment.loanId}:${installment.number}`}>
                  <TableCell className="sticky start-0 z-10 bg-card whitespace-nowrap">
                    {installment.loanName}
                  </TableCell>
                  <TableCell className="tabular">
                    {installment.number.toLocaleString("fa-IR")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatJalaliDate(new Date(installment.dueDate), {
                      style: "medium",
                    })}
                  </TableCell>
                  <TableCell>
                    <Money rial={installment.amount} unit={false} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

/** Category observations: figures and a direction, never a score (task 8.8). */
export function CategorySection({ reports }: { reports: ReportsDto }) {
  return (
    <Card variant="featured" className="gap-4">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>تحلیل دسته‌ها</CardTitle>
          <CardDescription>
            بزرگ‌ترین هزینه‌ها، تغییر نسبت به ماه قبل و بودجه هر دسته
          </CardDescription>
        </div>
      </CardHeader>

      {reports.categories.length === 0 ? (
        <p className="py-6 text-center text-body text-muted-foreground">
          در این بازه هزینه‌ای ثبت نشده است.
        </p>
      ) : (
        <div className="min-w-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 z-10 bg-card">دسته</TableHead>
                <TableHead>مجموع بازه</TableHead>
                <TableHead>سهم</TableHead>
                <TableHead>ماه قبل</TableHead>
                <TableHead>تغییر</TableHead>
                <TableHead>بودجه</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.categories.map((observation) => {
                const style = TREND_STYLE[observation.trend];
                const Icon = style.icon;

                return (
                  <TableRow key={observation.categoryId}>
                    <TableCell className="sticky start-0 z-10 bg-card whitespace-nowrap">
                      {observation.categoryName}
                    </TableCell>
                    <TableCell>
                      <Money rial={observation.amount} unit={false} />
                    </TableCell>
                    <TableCell className="tabular" dir="ltr">
                      {formatPercent(observation.share, { fractionDigits: 0 })}
                    </TableCell>
                    <TableCell>
                      <Money rial={observation.previous} unit={false} />
                    </TableCell>
                    <TableCell>
                      {/*
                        An icon as well as a colour, so the direction survives
                        a reader who cannot separate red from green (§59.3).
                      */}
                      {/*
                        A one-word label in the cell and the full phrase for
                        a screen reader: "کمتر از ماه قبل" wrapped onto three
                        lines in a narrow column and made every row tall.
                      */}
                      <span
                        className={cn(
                          "flex items-center gap-1.5 whitespace-nowrap",
                          style.className,
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="text-caption" aria-hidden>
                          {style.short}
                        </span>
                        <span className="sr-only">{style.label}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {observation.budget ? (
                        <Money rial={observation.budget} unit={false} />
                      ) : (
                        <Badge variant="outline">بدون بودجه</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
