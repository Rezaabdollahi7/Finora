import { Archive, CheckCircle2, Target } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { GOAL_STATE_LABELS } from "@/features/goals/progress";
import { GOAL_STATE_STYLE, GOAL_STATUS_STYLE } from "@/features/goals/format";
import { GoalActions } from "@/features/goals/components/goal-actions";
import { ContributionList } from "@/features/goals/components/contribution-list";
import { GoalProgressBar } from "@/features/goals/components/goal-progress";
import {
  GOAL_KIND_LABELS,
  GOAL_STATUS_LABELS,
  type GoalDetailDto,
} from "@/features/goals/types";

/**
 * One fact of the record as a small tile (§0.13), the same shape as
 * FactGrid's, kept local so the conditional rows above can stay inline.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-4 py-3">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body font-medium break-words">{children}</dd>
    </div>
  );
}

/** One goal in full: where it stands, what it needs, and its history. */
export function GoalDetail({ goal }: { goal: GoalDetailDto }) {
  const style = GOAL_STATE_STYLE[goal.progress.state];
  const Icon = style.icon;
  const overdue = goal.progress.state === "OVERDUE";

  return (
    <div className="space-y-6">
      {goal.status === "ARCHIVED" ? (
        <Alert variant="warning">
          <Archive />
          <AlertTitle>این هدف بایگانی شده است</AlertTitle>
          <AlertDescription>
            مبالغ کنارگذاشته‌شده حفظ شده‌اند، اما در فهرست اهداف و رقم ماهانه دیده
            نمی‌شود و مبلغ تازه‌ای نمی‌توان به آن افزود.
          </AlertDescription>
        </Alert>
      ) : goal.status === "COMPLETED" ? (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>این هدف تکمیل شده است</AlertTitle>
          <AlertDescription>
            اگر مبلغ هدف را بالا بردید یا از آن برداشت کردید، با «بازگشایی» دوباره در
            جریان قرارش دهید.
          </AlertDescription>
        </Alert>
      ) : null}

      <HeroCard
        label="کنار گذاشته‌شده"
        icon={Target}
        value={goal.progress.currentAmount}
        meta={
          <>
            <span>از</span>
            <Money
              rial={goal.progress.targetAmount}
              className="text-caption"
              unit={false}
            />
            <span>تومان</span>
          </>
        }
      >
        <GoalProgressBar
          progress={goal.progress}
          showAmounts={false}
          className="mt-2 max-w-xl"
        />
      </HeroCard>

      <GoalActions goal={goal} />

      <Card variant="featured" className="reveal gap-5 p-6">
        <h2 className="text-h4">مشخصات</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="وضعیت">
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={style.badge}>
                <Icon />
                {GOAL_STATE_LABELS[goal.progress.state]}
              </Badge>
              {goal.status !== "ACTIVE" ? (
                <Badge variant={GOAL_STATUS_STYLE[goal.status]}>
                  {GOAL_STATUS_LABELS[goal.status]}
                </Badge>
              ) : null}
            </span>
          </Field>
          <Field label="نوع">{GOAL_KIND_LABELS[goal.kind]}</Field>
          <Field label="مالک">
            <OwnerBadge owner={goal.owner} />
          </Field>
          <Field label="مبلغ هدف">
            <Money rial={goal.progress.targetAmount} />
          </Field>
          <Field label="باقی‌مانده">
            <Money rial={goal.progress.remainingAmount} />
          </Field>
          <Field label="تاریخ هدف">
            {goal.targetDate
              ? formatJalaliDate(new Date(goal.targetDate))
              : "بدون مهلت"}
          </Field>
          {goal.progress.monthsRemaining !== null ? (
            <Field label="ماه‌های باقی‌مانده">
              <span className="tabular">
                {goal.progress.monthsRemaining.toLocaleString("fa-IR")}
              </span>
            </Field>
          ) : null}
          {goal.progress.monthlyContribution !== null ? (
            <Field label={overdue ? "کسری تا هدف" : "ماهانه لازم"}>
              <span className={overdue ? "text-danger" : undefined}>
                <Money rial={goal.progress.monthlyContribution} />
              </span>
            </Field>
          ) : null}
          {goal.notes ? <Field label="یادداشت">{goal.notes}</Field> : null}
        </dl>
      </Card>

      <ContributionList goal={goal} />
    </div>
  );
}
