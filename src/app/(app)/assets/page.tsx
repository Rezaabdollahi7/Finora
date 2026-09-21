import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { assetFiltersSchema } from "@/features/assets/schemas";
import {
  getPortfolioSummary,
  listAssets,
} from "@/features/assets/server/asset-service";
import { AssetList } from "@/features/assets/components/asset-list";

const nav = requireNavItem("/assets");

export const metadata: Metadata = { title: nav.label };

/**
 * Read from the database on every request.
 *
 * Without this, Next prerenders the page at build time — a Prisma call is not
 * a dynamic API, so nothing opts the route out on its own, and every visitor
 * would see whatever assets existed when the image was built. See
 * docs/ARCHITECTURE.md.
 */
export const dynamic = "force-dynamic";

/**
 * Archived assets are listed so the archive/restore flow has something to
 * show; the list dims them and keeps them out of every total.
 */
export default async function AssetsPage() {
  const [assets, summary] = await Promise.all([
    listAssets(assetFiltersSchema.parse({ includeArchived: true })),
    getPortfolioSummary(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <AssetList assets={assets} summary={summary} />
    </div>
  );
}
