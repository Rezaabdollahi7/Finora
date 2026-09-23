import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import {
  getDataSummary,
  getDeploymentInfo,
} from "@/features/settings/server/settings-service";
import { SettingsView } from "@/features/settings/components/settings-view";

const nav = requireNavItem("/settings");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getDataSummary();

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <SettingsView deployment={getDeploymentInfo()} data={data} />
    </div>
  );
}
