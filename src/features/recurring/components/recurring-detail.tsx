import { PauseCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatJalaliDate, formatRelativeDay } from "@/utils/date";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import type { AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { OCCURRENCE_STATUS_LABELS } from "@/features/recurring/recurrence";
import { OCCURRENCE_STATUS_STYLE } from "@/features/recurring/format";
import { cadenceLabel } from "@/features/recurring/components/recurring-card";
import { OccurrenceList } from "@/features/recurring/components/occurrence-list";
import { RecurringActions } from "@/features/recurring/components/recurring-actions";
import type { RecurringPaymentDetailDto } from "@/features/recurring/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium">{children}</dd>
    </div>
  );
}

/** One recurring payment in full: what is next, the rule, and its occurrences. */
export function RecurringDetail({
  payment,
  accounts,
  categories,
  now,
}: {
  payment: RecurringPaymentDetailDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  now: Date;
}) {
  const nextDue = payment.nextDueDate ? new Date(payment.nextDueDate) : null;
  const isLate = payment.nextStatus === "OVERDUE";
  const style = payment.nextStatus ? OCCURRENCE_STATUS_STYLE[payment.nextStatus] : null;

  return (
    <div className="space-y-6">
      {!payment.isActive ? (
        <Alert variant="warning">
          <PauseCircle />
          <AlertTitle>این پرداخت غیرفعال است</AlertTitle>
          <AlertDescription>
            سررسید تازه‌ای ساخته نمی‌شود و در تقویم و پرداخت‌های پیش‌رو دیده نمی‌شود.
            هزینه‌های ثبت‌شده آن دست‌نخورده باقی مانده‌اند.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card variant="ink" padding="large" className="gap-2">
        <span className="text-body text-ink-surface-muted">مبلغ هر دوره</span>
        {/*
          The figure steps down on a phone; at the display size a
          thirteen-digit total spills out of a 390px card.
        */}
        <Money rial={payment.amount} className="text-h1 sm:text-display" unit={false} />
        {/*
          Each part is its own element: a neutral separator between Persian
          text and a number is reordered by the bidi algorithm.
        */}
        <span className="flex items-center gap-2 text-caption text-ink-surface-subtle">
          <span>تومان</span>
          <span aria-hidden>·</span>
          <span>{cadenceLabel(payment)}</span>
        </span>
        {nextDue ? (
          <span
            className={cn(
              "mt-2 flex flex-wrap items-center gap-2 text-caption",
              // A date that has passed is not "next", it is late.
              isLate ? "text-danger" : "text-ink-surface-muted",
            )}
          >
            <span>{isLate ? "سررسید گذشته" : "پرداخت بعدی"}</span>
            <span>{formatJalaliDate(nextDue, { style: "medium" })}</span>
            <span aria-hidden>·</span>
            <span>{formatRelativeDay(nextDue, { now })}</span>
          </span>
        ) : null}
      </Card>

      <RecurringActions payment={payment} accounts={accounts} categories={categories} />

      <Card variant="featured">
        <dl>
          <Field label="وضعیت">
            {style && payment.nextStatus ? (
              <Badge variant={style.tone}>
                <style.icon />
                {OCCURRENCE_STATUS_LABELS[payment.nextStatus]}
              </Badge>
            ) : (
              <Badge variant="outline">بدون سررسید پیش‌رو</Badge>
            )}
          </Field>
          <Field label="مالک">
            <OwnerBadge owner={payment.owner} />
          </Field>
          <Field label="دوره">{cadenceLabel(payment)}</Field>
          {payment.paymentDay !== null ? (
            <Field label="روز پرداخت هر ماه">
              <span className="tabular">
                {payment.paymentDay.toLocaleString("fa-IR")}
              </span>
            </Field>
          ) : null}
          <Field label="تاریخ شروع">
            {formatJalaliDate(new Date(payment.startDate))}
          </Field>
          <Field label="تاریخ پایان">
            {payment.endDate
              ? formatJalaliDate(new Date(payment.endDate))
              : "بدون پایان"}
          </Field>
          <Field label="حساب پرداخت">{payment.accountName ?? "انتخاب نشده"}</Field>
          <Field label="دسته‌بندی هزینه">{payment.categoryName ?? "بدون دسته"}</Field>
          <Field label="پرداخت‌های ثبت‌شده">
            <span className="tabular">{payment.paidCount.toLocaleString("fa-IR")}</span>
          </Field>
          <Field label="مجموع پرداخت‌شده">
            <Money rial={payment.paidTotal} />
          </Field>
          {payment.notes ? <Field label="یادداشت">{payment.notes}</Field> : null}
        </dl>
      </Card>

      <OccurrenceList payment={payment} accounts={accounts} now={now} />
    </div>
  );
}
