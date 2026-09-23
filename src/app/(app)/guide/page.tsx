import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { GuideView } from "@/features/guide/components/guide-view";

const nav = requireNavItem("/guide");

export const metadata: Metadata = { title: nav.label };

/** Static: the guide reads nothing from the database. */
export default function GuidePage() {
  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <GuideView />
    </div>
  );
}
