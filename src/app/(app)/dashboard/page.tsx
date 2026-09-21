import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { requireNavItem } from "@/config/navigation";
import {
  getCashFlow,
  getDashboardSummary,
  getExpensesByCategory,
} from "@/features/dashboard/server/dashboard-service";
import { CashFlowChart } from "@/features/dashboard/components/cash-flow-chart";
import { ExpenseCategoryChart } from "@/features/dashboard/components/expense-category-chart";
import { SummaryCards } from "@/features/dashboard/components/summary-cards";
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
  // One round of queries for the whole page rather than one per widget.
  const [summary, cashFlow, expenses] = await Promise.all([
    getDashboardSummary(),
    getCashFlow(6),
    getExpensesByCategory(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h2 className="text-h3">وضعیت مالی</h2>
        <Badge variant="neutral">{summary.period.label}</Badge>
      </div>

      <SummaryCards current={summary.current} previous={summary.previous} />

      {/*
        The cash-flow chart is the wider of the two and leads, since a trend
        answers "how are we doing" before a breakdown answers "on what".
      */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <CashFlowChart points={cashFlow} />
        </div>
        <div className="xl:col-span-2">
          <ExpenseCategoryChart slices={expenses} periodLabel={summary.period.label} />
        </div>
      </div>
    </div>
  );
}
