import type { Metadata } from "next";
import { z } from "zod";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { absoluteJalaliMonth, jalaliMonthOf } from "@/utils/date";
import { getHouseholdMonth } from "@/features/household/server/household-service";
import { HouseholdView } from "@/features/household/components/household-view";

const nav = requireNavItem("/household");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

/** The same bounds the budget month uses; a stray value falls back to now. */
const monthSchema = z
  .preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z
      .number()
      .int()
      .min(1300 * 12)
      .max(1500 * 12)
      .optional(),
  )
  .catch(undefined);

type Props = { searchParams: Promise<{ month?: string }> };

export default async function HouseholdPage({ searchParams }: Props) {
  const now = new Date();
  const { month } = await searchParams;
  const household = await getHouseholdMonth(monthSchema.parse(month), now);

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <HouseholdView
        household={household}
        currentMonth={absoluteJalaliMonth(jalaliMonthOf(now))}
      />
    </div>
  );
}
