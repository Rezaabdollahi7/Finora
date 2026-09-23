import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { AccountList } from "@/features/accounts/components/account-list";

const nav = requireNavItem("/accounts");

export const metadata: Metadata = { title: nav.label };

/**
 * Read from the database on every request.
 *
 * Without this, Next prerenders the page at build time — a Prisma call is not
 * a dynamic API, so nothing opts the route out on its own. The build output
 * marks it static and every visitor then sees whatever accounts existed when
 * the image was built, while the API returns the real data. Any page that
 * reads the database needs this line.
 */
export const dynamic = "force-dynamic";

/**
 * Archived accounts are included so the owner tabs and the archive/restore
 * flow have something to show; the list dims them and keeps them out of the
 * household total.
 */
export default async function AccountsPage() {
  const accounts = await listAccounts(
    accountFiltersSchema.parse({ includeArchived: true }),
  );

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <AccountList accounts={accounts} />
    </div>
  );
}
