import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { loanFiltersSchema } from "@/features/loans/schemas";
import { listLoans } from "@/features/loans/server/loan-service";
import { LoanList } from "@/features/loans/components/loan-list";

const nav = requireNavItem("/loans");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const now = new Date();

  const [loans, accounts, categories] = await Promise.all([
    listLoans(loanFiltersSchema.parse({ includeArchived: true }), now),
    listAccounts(accountFiltersSchema.parse({})),
    listCategoryTree({ includeArchived: false }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      {/*
        The server's clock travels with the data. Deriving "overdue" from the
        browser's clock instead would make a phone with the wrong date
        disagree with the figures rendered beside it.
      */}
      <LoanList
        loans={loans}
        accounts={accounts}
        categories={categories}
        nowIso={now.toISOString()}
      />
    </div>
  );
}
