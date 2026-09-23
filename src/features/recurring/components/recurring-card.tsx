import Link from "next/link";
import { Repeat } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatJalaliDate, formatRelativeDay } from "@/utils/date";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import {
  OCCURRENCE_STATUS_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_INTERVAL_UNITS,
} from "@/features/recurring/recurrence";
import { OCCURRENCE_STATUS_STYLE } from "@/features/recurring/format";
import type { RecurringPaymentDto } from "@/features/recurring/types";

/** "ماهانه" for an interval of one, "هر ۲ ماه" for anything else. */
export function cadenceLabel(payment: {
  frequency: RecurringPaymentDto["frequency"];
  interval: number;
}): string {
  if (payment.interval === 1) return RECURRENCE_FREQUENCY_LABELS[payment.frequency];

  return `هر ${payment.interval.toLocaleString("fa-IR")} ${RECURRENCE_INTERVAL_UNITS[payment.frequency]}`;
}

/**
 * One recurring payment in the list (task 5.5).
 *
 * The amount leads and the next date follows it, because those are the two
 * things a household checks. The whole card is the link, so the tap target on
 * a phone is the card rather than a word inside it (rule G.10).
 */
export function RecurringCard({
  payment,
  now,
}: {
  payment: RecurringPaymentDto;
  now: Date;
}) {
  const nextDue = payment.nextDueDate ? new Date(payment.nextDueDate) : null;
  const isLate = payment.nextStatus === "OVERDUE";
  const style = payment.nextStatus ? OCCURRENCE_STATUS_STYLE[payment.nextStatus] : null;

  return (
    <Card
      padding="none"
      className={cn("hover-lift h-full", !payment.isActive && "opacity-70")}
    >
      <Link
        href={`/recurring/${payment.id}`}
        className="flex h-full flex-col gap-5 rounded-xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Repeat className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{payment.name}</span>
              <span className="truncate text-caption text-muted-foreground">
                {cadenceLabel(payment)}
                {payment.categoryName ? ` · ${payment.categoryName}` : ""}
              </span>
            </span>
          </span>
          <OwnerBadge owner={payment.owner} />
        </div>

        <Money rial={payment.amount} className="text-h2 font-light tracking-tight" />

        <div className="mt-auto flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          {!payment.isActive ? (
            <Badge variant="outline">غیرفعال</Badge>
          ) : nextDue ? (
            <>
              <span
                className={cn(
                  "flex items-center gap-1.5",
                  // A date that has passed is not "next", it is late. Reading
                  // "پرداخت بعدی ۲۰ مرداد · ۴۲ روز پیش" is a contradiction,
                  // and it buries the thing that needs acting on.
                  isLate && "text-danger",
                )}
              >
                <span>{isLate ? "سررسید گذشته" : "پرداخت بعدی"}</span>
                <span>{formatJalaliDate(nextDue, { style: "medium" })}</span>
                <span aria-hidden>·</span>
                <span>{formatRelativeDay(nextDue, { now })}</span>
              </span>
              {/* Today is the one state the wording alone does not carry. */}
              {style && payment.nextStatus === "DUE" ? (
                <Badge variant={style.tone} className="ms-auto">
                  <style.icon />
                  {OCCURRENCE_STATUS_LABELS.DUE}
                </Badge>
              ) : null}
            </>
          ) : (
            <span>پرداخت دیگری در پیش نیست</span>
          )}
        </div>
      </Link>
    </Card>
  );
}
