import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { absoluteJalaliMonth, jalaliMonthOf } from "@/utils/date";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { reportFiltersSchema } from "@/features/reports/schemas";
import { getReports } from "@/features/reports/server/report-service";
import { ReportsView } from "@/features/reports/components/reports-view";

const nav = requireNavItem("/reports");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    owner?: string;
    accountId?: string;
    categoryId?: string;
  }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const now = new Date();
  const params = await searchParams;

  // A stray query string falls back to the default range rather than
  // showing an error page: a report is a read, and a bad link is not worth
  // a dead end.
  const parsed = reportFiltersSchema.safeParse({
    fromMonth: params.from ?? undefined,
    toMonth: params.to ?? undefined,
    owner: params.owner ?? undefined,
    accountId: params.accountId ?? undefined,
    categoryId: params.categoryId ?? undefined,
  });

  const [reports, accounts, categories] = await Promise.all([
    getReports(parsed.success ? parsed.data : {}, now),
    listAccounts(accountFiltersSchema.parse({})),
    listCategoryTree({ includeArchived: false }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <ReportsView
        reports={reports}
        currentMonth={absoluteJalaliMonth(jalaliMonthOf(now))}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
