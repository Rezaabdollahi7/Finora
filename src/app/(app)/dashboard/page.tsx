import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { requireNavItem } from "@/config/navigation";
import { transactionFiltersSchema } from "@/features/transactions/schemas";
import { listTransactions } from "@/features/transactions/server/transaction-service";
import {
  getAccountDistribution,
  getCashFlow,
  getDashboardSummary,
  getExpensesByCategory,
  getNetWorthHistory,
} from "@/features/dashboard/server/dashboard-service";
import { AccountDistribution } from "@/features/dashboard/components/account-distribution";
import { CashFlowChart } from "@/features/dashboard/components/cash-flow-chart";
import { ExpenseCategoryChart } from "@/features/dashboard/components/expense-category-chart";
import { NetWorthChart } from "@/features/dashboard/components/net-worth-chart";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { SummaryCards } from "@/features/dashboard/components/summary-cards";
import { UpcomingPayments } from "@/features/dashboard/components/upcoming-payments";
import DashboardLoading from "./loading";

const nav = requireNavItem("/dashboard");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  /*
   * One round of queries for the whole page. Each aggregate is bounded and
   * independent, so they run together rather than in sequence, and the
   * browser receives figures rather than a ledger to add up (task 2.10).
   */
  const [summary, cashFlow, expenses, accounts, netWorth, recent] = await Promise.all([
    getDashboardSummary(),
    getCashFlow(6),
    getExpensesByCategory(),
    getAccountDistribution(),
    getNetWorthHistory("M6"),
    listTransactions(transactionFiltersSchema.parse({ pageSize: 6 })),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h2 className="text-h3">وضعیت مالی</h2>
        <Badge variant="neutral">{summary.period.label}</Badge>
      </div>

      <SummaryCards current={summary.current} previous={summary.previous} />

      {/*
       * Reading order is the same at every width, because the mobile column
       * is the desktop grid read top-to-bottom: how are we doing (cash
       * flow), where did it go (expenses), where is it (accounts), where is
       * it heading (net worth), what just happened (recent), what is due
       * next (upcoming). On a phone that is the order a household scrolls
       * through, not a desktop layout squeezed narrow (task 2.9).
       */}
      {/*
       * min-w-0 on every cell: a grid item defaults to min-width:auto, so a
       * chart's measured width can push its track wider than the container
       * and take the whole page with it. It cost 17px of horizontal scroll
       * at 390px before this.
       */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3">
          <CashFlowChart points={cashFlow} />
        </div>
        <div className="min-w-0 xl:col-span-2">
          <ExpenseCategoryChart slices={expenses} periodLabel={summary.period.label} />
        </div>
        <div className="min-w-0 xl:col-span-2">
          <AccountDistribution shares={accounts} />
        </div>
        <div className="min-w-0 xl:col-span-3">
          <NetWorthChart initialPoints={netWorth} />
        </div>
        <div className="min-w-0 xl:col-span-3">
          <RecentTransactions transactions={recent.transactions} />
        </div>
        <div className="min-w-0 xl:col-span-2">
          <UpcomingPayments payments={summary.upcomingPayments} />
        </div>
      </div>
    </div>
  );
}
