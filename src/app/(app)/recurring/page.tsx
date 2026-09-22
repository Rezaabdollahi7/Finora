import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { recurringFiltersSchema } from "@/features/recurring/schemas";
import {
  listRecurringPayments,
  occurrencesForWindow,
} from "@/features/recurring/server/recurring-service";
import { RecurringList } from "@/features/recurring/components/recurring-list";

const nav = requireNavItem("/recurring");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function RecurringPage() {
  const now = new Date();

  // Far enough back to catch arrears, far enough forward for the headline.
  const window = {
    start: new Date(now.getTime() - 90 * DAY),
    end: new Date(now.getTime() + 30 * DAY),
  };

  const [payments, occurrences, accounts, categories] = await Promise.all([
    listRecurringPayments(recurringFiltersSchema.parse({ includeInactive: true }), now),
    occurrencesForWindow(window, now),
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
      <RecurringList
        payments={payments}
        occurrences={occurrences}
        accounts={accounts}
        categories={categories}
        nowIso={now.toISOString()}
      />
    </div>
  );
}
