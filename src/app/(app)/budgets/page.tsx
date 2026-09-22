import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { absoluteJalaliMonth, jalaliMonthOf } from "@/utils/date";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { budgetMonthQuerySchema } from "@/features/budgets/schemas";
import { getBudgetMonth } from "@/features/budgets/server/budget-service";
import { BudgetList } from "@/features/budgets/components/budget-list";

const nav = requireNavItem("/budgets");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string }> };

export default async function BudgetsPage({ searchParams }: Props) {
  const now = new Date();
  const { month } = budgetMonthQuerySchema.parse(await searchParams);

  const [budget, categories] = await Promise.all([
    getBudgetMonth(month, now),
    listCategoryTree({ includeArchived: false }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <BudgetList
        budget={budget}
        currentMonth={absoluteJalaliMonth(jalaliMonthOf(now))}
        categories={categories}
      />
    </div>
  );
}
