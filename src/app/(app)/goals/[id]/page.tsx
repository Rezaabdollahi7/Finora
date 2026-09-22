import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { getGoal } from "@/features/goals/server/goal-service";
import { GoalDetail } from "@/features/goals/components/goal-detail";
import { GOAL_KIND_LABELS } from "@/features/goals/types";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const goal = await getGoal(id);

  return { title: goal?.name ?? "هدف" };
}

export default async function GoalDetailPage({ params }: Props) {
  const { id } = await params;
  const goal = await getGoal(id, new Date());

  if (!goal) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={goal.name}
        description={GOAL_KIND_LABELS[goal.kind]}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/goals">
              {/* The arrow points the way "back" goes in RTL: to the right. */}
              <ArrowRight />
              همه اهداف
            </Link>
          </Button>
        }
      />
      <GoalDetail goal={goal} />
    </div>
  );
}
