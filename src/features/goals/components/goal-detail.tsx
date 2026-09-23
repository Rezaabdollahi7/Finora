import { Archive, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium">{children}</dd>
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

      <Card variant="ink" padding="large" className="gap-2">
        <span className="text-body text-ink-surface-muted">کنار گذاشته‌شده</span>
        {/*
          The figure steps down on a phone; at the display size a
          thirteen-digit total spills out of a 390px card.
        */}
        <Money
          rial={goal.progress.currentAmount}
          className="text-h1 sm:text-display"
          unit={false}
        />
        {/*
          Each part is its own element: a neutral separator between Persian
          text and a number is reordered by the bidi algorithm.
        */}
        <span className="flex flex-wrap items-center gap-2 text-caption text-ink-surface-subtle">
          <span>تومان</span>
          <span aria-hidden>·</span>
          <span>از</span>
          <Money
            rial={goal.progress.targetAmount}
            className="text-caption"
            unit={false}
          />
          <span>تومان</span>
        </span>
        <GoalProgressBar
          progress={goal.progress}
          showAmounts={false}
          className="mt-4"
        />
      </Card>

      <GoalActions goal={goal} />

      <Card variant="featured">
        <dl>
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
