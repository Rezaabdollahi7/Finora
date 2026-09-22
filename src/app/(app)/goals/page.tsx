import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { goalFiltersSchema } from "@/features/goals/schemas";
import { listGoals } from "@/features/goals/server/goal-service";
import { GoalList } from "@/features/goals/components/goal-list";

const nav = requireNavItem("/goals");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const now = new Date();
  const goals = await listGoals(
    goalFiltersSchema.parse({ includeArchived: true }),
    now,
  );

  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      {/*
        Every figure comes from the server's clock, including how many months
        a goal has left. A phone with the wrong date must not disagree with
        the numbers rendered beside it.
      */}
      <GoalList goals={goals} />
    </div>
  );
}
