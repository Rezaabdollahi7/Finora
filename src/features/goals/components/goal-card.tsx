import Link from "next/link";
import { Target } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { GOAL_STATE_LABELS } from "@/features/goals/progress";
import { GOAL_STATE_STYLE } from "@/features/goals/format";
import { GoalProgressBar } from "@/features/goals/components/goal-progress";
import { GOAL_KIND_LABELS, type GoalDto } from "@/features/goals/types";

/**
 * One goal in the list (task 6.5).
 *
 * The monthly figure is the line that earns the card its place: a progress
 * bar says where the household is, and only "۸ میلیون در ماه" says what to do
 * about it.
 *
 * The whole card is the link, so the tap target on a phone is the card
 * rather than a word inside it (rule G.10).
 */
export function GoalCard({ goal }: { goal: GoalDto }) {
  const style = GOAL_STATE_STYLE[goal.progress.state];
  const Icon = style.icon;
  const archived = goal.status === "ARCHIVED";

  return (
    <Card padding="none" className={cn("hover-lift h-full", archived && "opacity-70")}>
      <Link
        href={`/goals/${goal.id}`}
        className="flex h-full flex-col gap-5 rounded-xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Target className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{goal.name}</span>
              <span className="truncate text-caption text-muted-foreground">
                {GOAL_KIND_LABELS[goal.kind]}
              </span>
            </span>
          </span>
          <OwnerBadge owner={goal.owner} />
        </div>

        <GoalProgressBar progress={goal.progress} />

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
          {archived ? (
            <Badge variant="outline">بایگانی</Badge>
          ) : goal.progress.isReached ? (
            <Badge variant={style.badge}>
              <Icon />
              {GOAL_STATE_LABELS.REACHED}
            </Badge>
          ) : goal.progress.monthlyContribution ? (
            <span
              className={cn(
                "flex items-baseline gap-2",
                goal.progress.state === "OVERDUE" && "text-danger",
              )}
            >
              <span>{goal.progress.state === "OVERDUE" ? "کسری" : "ماهانه لازم"}</span>
              <Money
                rial={goal.progress.monthlyContribution}
                unit={false}
                className="font-medium"
              />
            </span>
          ) : (
            <span className="flex items-baseline gap-2">
              <span>باقی‌مانده</span>
              <Money
                rial={goal.progress.remainingAmount}
                unit={false}
                className="font-medium"
              />
            </span>
          )}

          {goal.targetDate ? (
            <span className="ms-auto">
              {formatJalaliDate(new Date(goal.targetDate), { style: "medium" })}
            </span>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}
