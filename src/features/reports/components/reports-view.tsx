"use client";

import * as React from "react";
import { FileBarChart } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeroCard } from "@/components/common/hero-card";
import { formatPercent } from "@/utils/number";
import { OWNER_LABELS } from "@/features/accounts/types";
import type { AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { ReportFilterBar } from "@/features/reports/components/report-filters";
import {
  AssetSection,
  BucketTable,
  CashFlowSection,
  CategorySection,
  DebtSection,
  Figure,
  NetWorthSection,
} from "@/features/reports/components/report-sections";
import type { ReportsDto } from "@/features/reports/types";

const TABS = [
  { value: "MONTHLY", label: "ماهانه" },
  { value: "INCOME", label: "درآمد" },
  { value: "EXPENSE", label: "هزینه" },
  { value: "SAVINGS", label: "پس‌انداز" },
  { value: "DEBT", label: "بدهی" },
  { value: "ASSETS", label: "دارایی" },
  { value: "NET_WORTH", label: "ارزش خالص" },
  { value: "CATEGORIES", label: "دسته‌ها" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

/**
 * The reports screen (tasks 8.1–8.10).
 *
 * One set of filters at the top and one report at a time below it. Every tab
 * reads the same fetched range, so switching between them is instant and
 * never disagrees with itself — a savings figure on one tab and an income
 * figure on another are from the same rows.
 *
 * The tabs are client state while the filters are in the URL, and that split
 * is deliberate: which report you are reading is not worth a round trip, but
 * which months you are reading is worth a link.
 */
export function ReportsView({
  reports,
  currentMonth,
  accounts,
  categories,
}: {
  reports: ReportsDto;
  currentMonth: number;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
}) {
  const [tab, setTab] = React.useState<TabValue>("MONTHLY");

  const savings = BigInt(reports.savings.savings);
  const overspent = savings < 0n;

  const filterSummary = [
    reports.filters.owner ? OWNER_LABELS[reports.filters.owner] : null,
    reports.filters.accountId
      ? (accounts.find((a) => a.id === reports.filters.accountId)?.name ?? null)
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <HeroCard
        label={`پس‌انداز ${reports.from.label} تا ${reports.to.label}`}
        icon={FileBarChart}
        value={overspent ? (-savings).toString() : reports.savings.savings}
        negative={overspent}
        meta={
          <>
            {reports.savings.savingsRate !== null ? (
              <>
                <span className="tabular" dir="ltr">
                  {formatPercent(reports.savings.savingsRate, { fractionDigits: 0 })}
                </span>
                <span>نرخ پس‌انداز</span>
              </>
            ) : (
              <span>در این بازه درآمدی ثبت نشده است</span>
            )}
            {filterSummary.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{filterSummary.join("، ")}</span>
              </>
            ) : null}
          </>
        }
        stats={[
          { label: "درآمد", rial: reports.savings.income },
          { label: "هزینه", rial: reports.savings.expenses },
        ]}
      />

      <ReportFilterBar
        reports={reports}
        currentMonth={currentMonth}
        accounts={accounts}
        categories={categories}
      />

      {/*
        Eight tabs wrap onto two or three rows on a phone rather than
        scrolling sideways, and that is the considered choice: a horizontal
        scroller here put the last tab at x=-233 on a 390px screen, reachable
        by nothing — an RTL scroll container's overflow runs left, where it
        cannot be scrolled to. Measured across four variants; wrapping was
        the only one where every tab could be reached at all.

        Hidden in print, because a printed report shows every section and has
        nothing to click.
      */}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as TabValue);
        }}
        className="print:hidden"
      >
        <TabsList className="justify-start">
          {TABS.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-6">
        {tab === "MONTHLY" ? <MonthlySection reports={reports} /> : null}
        {tab === "INCOME" ? (
          <>
            <CashFlowSection reports={reports} />
            <BucketTable
              title="درآمد بر اساس مالک"
              description="سهم هر نفر از درآمد بازه"
              buckets={reports.income.byOwner}
              emptyTitle="در این بازه درآمدی ثبت نشده است."
            />
            <BucketTable
              title="درآمد بر اساس منبع"
              description="دسته‌بندی درآمدها"
              buckets={reports.income.byCategory}
              emptyTitle="درآمدی برای تفکیک نیست."
            />
            <BucketTable
              title="درآمد بر اساس حساب"
              description="پول به کدام حساب وارد شده است"
              buckets={reports.income.byAccount}
              emptyTitle="درآمدی برای تفکیک نیست."
            />
          </>
        ) : null}
        {tab === "EXPENSE" ? (
          <>
            <CashFlowSection reports={reports} />
            <BucketTable
              title="هزینه بر اساس دسته"
              description="بزرگ‌ترین دسته‌ها در بازه"
              buckets={reports.expenses.byCategory}
              emptyTitle="در این بازه هزینه‌ای ثبت نشده است."
            />
            <BucketTable
              title="هزینه بر اساس مالک"
              description="خرج مشترک و خرج شخصی هر نفر"
              buckets={reports.expenses.byOwner}
              emptyTitle="هزینه‌ای برای تفکیک نیست."
            />
            <BucketTable
              title="هزینه بر اساس حساب"
              description="پول از کدام حساب خارج شده است"
              buckets={reports.expenses.byAccount}
              emptyTitle="هزینه‌ای برای تفکیک نیست."
            />
          </>
        ) : null}
        {tab === "SAVINGS" ? <SavingsSection reports={reports} /> : null}
        {tab === "DEBT" ? <DebtSection reports={reports} /> : null}
        {tab === "ASSETS" ? <AssetSection reports={reports} /> : null}
        {tab === "NET_WORTH" ? <NetWorthSection reports={reports} /> : null}
        {tab === "CATEGORIES" ? <CategorySection reports={reports} /> : null}
      </div>

      {/*
        Print shows the whole report rather than whichever tab happened to be
        open, because a printed page has no tabs to click.
      */}
      <div className="hidden print:block print:space-y-6">
        <MonthlySection reports={reports} />
        <SavingsSection reports={reports} />
        <DebtSection reports={reports} />
        <AssetSection reports={reports} />
        <NetWorthSection reports={reports} />
        <CategorySection reports={reports} />
      </div>
    </div>
  );
}

/** The monthly financial report: the range's last month in full (task 8.1). */
function MonthlySection({ reports }: { reports: ReportsDto }) {
  const { monthly } = reports;
  const overspent = BigInt(monthly.savings) < 0n;

  return (
    <Card variant="featured" className="gap-6">
      <div className="space-y-1">
        <h2 className="text-h3 font-light">گزارش {monthly.label}</h2>
        <p className="text-body text-muted-foreground">
          درآمد، هزینه، پس‌انداز، سرمایه‌گذاری و بازپرداخت بدهی در این ماه
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Figure label="درآمد" rial={monthly.income} />
        <Figure label="هزینه" rial={monthly.expenses} />
        <Figure
          label={overspent ? "کسری" : "پس‌انداز"}
          rial={overspent ? (-BigInt(monthly.savings)).toString() : monthly.savings}
          tone={overspent ? "danger" : "success"}
          hint={
            monthly.savingsRate === null
              ? "درآمدی برای محاسبه نرخ نیست"
              : `نرخ ${formatPercent(monthly.savingsRate, { fractionDigits: 0 })}`
          }
        />
        <Figure
          label="سرمایه‌گذاری"
          rial={monthly.investments}
          hint="دارایی‌های خریداری‌شده، به بهای خرید"
        />
        <Figure
          label="بازپرداخت بدهی"
          rial={monthly.debtPayments}
          hint="اقساط پرداخت‌شده در این ماه"
        />
        <Figure
          label="تغییر ارزش خالص"
          rial={monthly.netWorth.amount}
          tone={BigInt(monthly.netWorth.amount) < 0n ? "danger" : "success"}
          hint={
            monthly.netWorth.ratio === null
              ? "ماه قبلی برای مقایسه نیست"
              : `${formatPercent(monthly.netWorth.ratio, { fractionDigits: 1 })} نسبت به ماه قبل`
          }
        />
      </div>
    </Card>
  );
}

/** Savings and the savings rate, month by month (task 8.4). */
function SavingsSection({ reports }: { reports: ReportsDto }) {
  return (
    <div className="space-y-6">
      <Card variant="featured" className="gap-6">
        <div className="space-y-1">
          <h2 className="text-h3 font-light">پس‌انداز</h2>
          <p className="text-body text-muted-foreground">
            درآمد منهای هزینه، و نسبت آن به درآمد
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Figure label="درآمد بازه" rial={reports.savings.income} />
          <Figure label="هزینه بازه" rial={reports.savings.expenses} />
          <Figure
            label="پس‌انداز بازه"
            rial={reports.savings.savings}
            hint={
              reports.savings.savingsRate === null
                ? "درآمدی برای محاسبه نرخ نیست"
                : `نرخ ${formatPercent(reports.savings.savingsRate, { fractionDigits: 0 })}`
            }
          />
        </div>
      </Card>

      <CashFlowSection reports={reports} />

      {reports.series.every((point) => point.income === "0") ? (
        <Card variant="featured">
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FileBarChart className="size-8 text-muted-foreground" />
            <p className="text-body text-muted-foreground">
              تا وقتی درآمدی ثبت نشده باشد، نرخ پس‌انداز معنایی ندارد.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
