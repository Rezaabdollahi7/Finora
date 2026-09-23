"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, TrendingUp, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import {
  FORECAST_PERIODS,
  FORECAST_PERIOD_LABELS,
  type ForecastPeriod,
} from "@/features/forecast/forecast";
import { ForecastChart } from "@/features/forecast/components/forecast-chart";
import type { ForecastDto } from "@/features/forecast/types";

/**
 * The cash-flow forecast (tasks 6.6–6.9).
 *
 * The warning leads, because it is the only part that asks for a decision
 * today. Everything below it is context for that decision: the chart shows
 * where the money goes, and the table says which of the four things — income,
 * loans, recurring payments, budgets — is doing it.
 */
export function ForecastView({ forecast }: { forecast: ForecastDto }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  function selectPeriod(period: ForecastPeriod) {
    setPending(true);
    router.push(period === 3 ? "/forecast" : `/forecast?period=${period}`);
  }

  const shortfall = forecast.points.find((point) => point.isShortfall);

  return (
    <div className="space-y-6">
      {forecast.warning ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>
            هشدار جریان نقدی — در {forecast.warning.days.toLocaleString("fa-IR")} روز
            آینده
          </AlertTitle>
          <AlertDescription>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3">
              <div className="flex items-baseline gap-2">
                <dt>موجودی قابل استفاده</dt>
                <dd className="font-medium">
                  <Money rial={forecast.warning.availableBalance} unit={false} />
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt>پرداخت‌های پیش‌بینی‌شده</dt>
                <dd className="font-medium">
                  <Money rial={forecast.warning.expectedPayments} unit={false} />
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt>کسری احتمالی</dt>
                <dd className="font-medium">
                  <Money rial={forecast.warning.shortfall} />
                </dd>
              </div>
            </dl>
          </AlertDescription>
        </Alert>
      ) : null}

      <HeroCard
        label="موجودی قابل استفاده"
        icon={TrendingUp}
        value={forecast.openingBalance}
        meta={<span>حساب‌های بانکی، نقد و کیف پول</span>}
      >
        {shortfall ? (
          <span className="flex flex-wrap items-baseline gap-2 text-caption text-danger">
            <span>با این روند، در {shortfall.label} موجودی به</span>
            <Money rial={shortfall.closingBalance} className="font-medium" />
            <span>می‌رسد</span>
          </span>
        ) : (
          <span className="text-caption text-on-brand/75">
            در این بازه کسری پیش‌بینی نمی‌شود
          </span>
        )}
      </HeroCard>

      <Card variant="featured" className="gap-6">
        <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <CardTitle>روند موجودی</CardTitle>
            <CardDescription>
              موجودی پایان هر ماه، با درآمد انتظاری منهای اقساط، پرداخت‌های دوره‌ای و
              بودجه‌ها
            </CardDescription>
          </div>
          <Tabs
            value={String(forecast.period)}
            onValueChange={(value) => {
              selectPeriod(Number(value) as ForecastPeriod);
            }}
          >
            <TabsList>
              {FORECAST_PERIODS.map((period) => (
                <TabsTrigger key={period} value={String(period)}>
                  {FORECAST_PERIOD_LABELS[period]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>

        <div
          className="transition-opacity"
          style={{ opacity: pending ? 0.6 : 1 }}
          aria-busy={pending}
        >
          <ForecastChart
            points={forecast.points}
            openingBalance={forecast.openingBalance}
          />
        </div>
      </Card>

      {BigInt(forecast.expectedIncome) === 0n ? (
        <Alert variant="info">
          <Info />
          <AlertTitle>درآمدی برای تخمین وجود ندارد</AlertTitle>
          <AlertDescription>
            تا وقتی درآمدی ثبت نشده باشد، پیش‌بینی فقط خرج‌ها را نشان می‌دهد و طبیعتاً
            رو به پایین است. با ثبت درآمد ماه‌های گذشته، تخمین واقعی می‌شود.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info">
          <Info />
          <AlertTitle>
            درآمد ماهانه بر اساس میانه ماه‌های گذشته تخمین زده شده است
          </AlertTitle>
          <AlertDescription>
            <span className="flex flex-wrap items-baseline gap-2">
              <Money rial={forecast.expectedIncome} className="font-medium" />
              <span>در ماه، از</span>
              <span className="tabular">
                {forecast.incomeMonths.toLocaleString("fa-IR")}
              </span>
              <span>ماه ثبت‌شده. خرج‌های خارج از بودجه در این پیش‌بینی نمی‌آیند.</span>
            </span>
          </AlertDescription>
        </Alert>
      )}

      {forecast.points.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="چیزی برای پیش‌بینی نیست"
          description="با ثبت حساب، درآمد و پرداخت‌های دوره‌ای، روند ماه‌های پیش‌رو اینجا ساخته می‌شود."
        />
      ) : (
        <ForecastTable forecast={forecast} />
      )}
    </div>
  );
}

/**
 * The figures behind the chart.
 *
 * A chart says the household runs out in Azar; only the columns say whether
 * that is the loan, the rent or the budgets doing it. On a phone the table
 * scrolls sideways rather than shrinking to unreadable (rule G.10).
 */
function ForecastTable({ forecast }: { forecast: ForecastDto }) {
  return (
    <Card variant="featured" className="gap-4">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>جزئیات ماه‌به‌ماه</CardTitle>
          <CardDescription>هر ماه با موجودی پایان ماه قبل شروع می‌شود.</CardDescription>
        </div>
      </CardHeader>

      {/*
        The shared Table, whose wrapper already scrolls horizontally, rather
        than a hand-rolled one. `min-w-0` is what makes that wrapper actually
        scroll: the Card is a flex column, and a flex item's default
        `min-width: auto` let the container grow to the table's width instead
        — 242px past the edge of a 390px phone, measured.
      */}
      <div className="min-w-0">
        <Table>
          <TableHeader>
            <TableRow>
              {/*
                The month stays put while the figures scroll. On a phone the
                table is 567px in a 308px box, and whichever end it opens at
                the labels would otherwise be off-screen — a column of
                numbers with nothing saying which month each belongs to.
              */}
              <TableHead className="sticky start-0 z-10 bg-card">ماه</TableHead>
              <TableHead>درآمد</TableHead>
              <TableHead>اقساط</TableHead>
              <TableHead>دوره‌ای</TableHead>
              <TableHead>بودجه</TableHead>
              <TableHead>پایان ماه</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecast.points.map((point) => (
              <TableRow
                key={point.month}
                className={cn(point.isShortfall && "bg-danger-subtle")}
              >
                <TableCell
                  className={cn(
                    "sticky start-0 z-10 whitespace-nowrap",
                    // Matches the row beneath it, so the scrolling figures
                    // pass under the label rather than showing through it.
                    point.isShortfall ? "bg-danger-subtle" : "bg-card",
                  )}
                >
                  {point.label}
                </TableCell>
                <TableCell>
                  <Money rial={point.income} unit={false} />
                </TableCell>
                <TableCell>
                  <Money rial={point.loanPayments} unit={false} />
                </TableCell>
                <TableCell>
                  <Money rial={point.recurringExpenses} unit={false} />
                </TableCell>
                <TableCell>
                  <Money rial={point.budgetedExpenses} unit={false} />
                </TableCell>
                <TableCell
                  className={cn("font-medium", point.isShortfall && "text-danger")}
                >
                  <Money rial={point.closingBalance} unit={false} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
