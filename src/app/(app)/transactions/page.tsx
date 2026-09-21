import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { SectionPlaceholder } from "@/components/common/section-placeholder";
import { requireNavItem } from "@/config/navigation";

const nav = requireNavItem("/transactions");

export const metadata: Metadata = { title: nav.label };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <SectionPlaceholder sprint="اسپرینت ۱" />
    </div>
  );
}
