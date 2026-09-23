import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/common/page-header";
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
import { BalanceHero } from "@/features/dashboard/components/balance-hero";
import { BentoCell, BentoGrid } from "@/features/dashboard/components/bento";
import { CashFlowChart } from "@/features/dashboard/components/cash-flow-chart";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { ExpenseCategoryChart } from "@/features/dashboard/components/expense-category-chart";
import { MonthPace } from "@/features/dashboard/components/month-pace";
import { NetWorthChart } from "@/features/dashboard/components/net-worth-chart";
import { NetWorthComposition } from "@/features/dashboard/components/net-worth-composition";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
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

  /*
   * The bento (docs/DESIGN_SYSTEM.md §0.9). Reading order is the same at
   * every width, because the phone column is the desktop grid read top to
   * bottom: the month at a glance, how much there is, how the months have
   * gone, the month's pace, what it all adds up to and where it is heading, where
   * the money went, what just happened, what is due next, and where the
   * money sits. Spans live here, in one place, not inside the cards.
   */
  return (
    <BentoGrid>
      <BentoCell className="md:col-span-6 xl:col-span-12">
        <DashboardOverview
          period={summary.period}
          current={summary.current}
          previous={summary.previous}
        />
      </BentoCell>

      <BentoCell className="md:col-span-6 xl:col-span-5 xl:row-span-2">
        <BalanceHero
          balance={summary.current.totalBalance}
          previous={summary.previous.totalBalance}
          className="h-full"
        />
      </BentoCell>
      <BentoCell className="md:col-span-6 xl:col-span-7">
        <CashFlowChart points={cashFlow} />
      </BentoCell>
      <BentoCell className="md:col-span-3 xl:col-span-3">
        <MonthPace period={summary.period} savings={summary.current.monthlySavings} />
      </BentoCell>
      <BentoCell className="md:col-span-3 xl:col-span-4">
        <NetWorthComposition current={summary.current} previous={summary.previous} />
      </BentoCell>

      <BentoCell className="md:col-span-6 xl:col-span-8">
        <NetWorthChart initialPoints={netWorth} />
      </BentoCell>
      <BentoCell className="md:col-span-6 xl:col-span-4">
        <ExpenseCategoryChart slices={expenses} periodLabel={summary.period.label} />
      </BentoCell>

      <BentoCell className="md:col-span-6 xl:col-span-7">
        <RecentTransactions transactions={recent.transactions} />
      </BentoCell>
      <BentoCell className="md:col-span-6 xl:col-span-5">
        <UpcomingPayments payments={summary.upcomingPayments} />
      </BentoCell>

      <BentoCell className="md:col-span-6 xl:col-span-12">
        <AccountDistribution shares={accounts} />
      </BentoCell>
    </BentoGrid>
  );
}
