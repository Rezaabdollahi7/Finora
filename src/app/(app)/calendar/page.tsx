import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { jalaliMonthOf } from "@/utils/date";
import { getCalendarMonth } from "@/features/calendar/server/calendar-service";
import { CalendarView } from "@/features/calendar/components/calendar-view";

const nav = requireNavItem("/calendar");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const now = new Date();
  const month = await getCalendarMonth(jalaliMonthOf(now), now);

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <CalendarView initial={month} nowIso={now.toISOString()} />
    </div>
  );
}
