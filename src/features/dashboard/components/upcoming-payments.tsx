import Link from "next/link";
import {
  CalendarCheck,
  Landmark,
  Receipt,
  Repeat,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import {
  CALENDAR_EVENT_KIND_LABELS,
  type CalendarEventKind,
} from "@/features/calendar/types";
import { groupUpcomingPayments } from "@/features/dashboard/upcoming";
import { CardLink } from "@/features/dashboard/components/bento";
import type { UpcomingBucket, UpcomingPayment } from "@/features/dashboard/types";

/** Past this many rows the card stops being a glance; the rest are one link away. */
const MAX_ROWS = 5;

const KIND_ICON: Record<CalendarEventKind, LucideIcon> = {
  LOAN_INSTALLMENT: Landmark,
  RECURRING: Repeat,
  BILL: Receipt,
  GOAL_CONTRIBUTION: Target,
  OTHER: Wallet,
};

/**
 * What the household owes next (task 2.8), as the dark card of the
 * reference boards: a short to-do list of payments, with two paler cards
 * peeking out behind it to say "there is a stack of these".
 *
 * Grouped into the horizons people actually plan in — today, tomorrow, this
 * week — rather than listed as dates, because "فردا" is the information and
 * the date is the detail. The count in the corner is how many are coming;
 * the card lists the first few and links to the calendar for the rest, so
 * a household with a backlog of instalments gets a card, not a scroll.
 */
export function UpcomingPayments({
  payments,
  className,
}: {
  payments: UpcomingPayment[];
  className?: string;
}) {
  const buckets = limitRows(groupUpcomingPayments(payments), MAX_ROWS);
  const hidden =
    payments.length - buckets.reduce((sum, bucket) => sum + bucket.payments.length, 0);

  return (
    <div className={cn("relative flex h-full flex-col pt-5", className)}>
      {/* The stack behind the card. */}
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-10 rounded-t-2xl bg-ink-surface opacity-25"
      />
      <span
        aria-hidden
        className="absolute inset-x-4 top-2.5 h-10 rounded-t-2xl bg-ink-surface opacity-50"
      />

      <Card variant="ink" className="relative h-full gap-5 p-6">
        <CardHeader className="items-center">
          <CardTitle className="text-ink-surface-foreground">
            پرداخت‌های پیش‌رو
          </CardTitle>
          <div className="flex items-center gap-3">
            {payments.length > 0 ? (
              <span
                className="tabular text-display leading-none font-light"
                aria-label={`${payments.length.toLocaleString("fa-IR")} پرداخت`}
              >
                {payments.length.toLocaleString("fa-IR")}
              </span>
            ) : null}
            <CardLink
              href="/calendar"
              label="تقویم مالی"
              className="border-transparent bg-ink-surface-subtle text-ink-surface-foreground shadow-none"
            />
          </div>
        </CardHeader>

        {buckets.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-ink-surface-subtle px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
              <CalendarCheck aria-hidden className="size-5" />
            </span>
            <p className="text-body-lg font-medium">پرداخت پیش‌رویی نیست</p>
            <p className="max-w-xs text-body text-ink-surface-muted">
              اقساط وام و پرداخت‌های دوره‌ای، به محض نزدیک شدن سررسیدشان، اینجا فهرست
              می‌شوند.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {buckets.map((bucket) => (
              <li key={bucket.key} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3 text-caption text-ink-surface-muted">
                  <h3 className="font-medium">{bucket.label}</h3>
                  <Money rial={bucket.total} className="text-caption" unit={false} />
                </div>
                <ul className="flex flex-col gap-1">
                  {bucket.payments.map((payment) => {
                    const Icon = KIND_ICON[payment.kind];

                    return (
                      <li
                        key={payment.id}
                        className="flex items-center gap-3 rounded-lg px-1 py-1.5 text-body"
                      >
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink-surface-subtle"
                          title={CALENDAR_EVENT_KIND_LABELS[payment.kind]}
                        >
                          <Icon aria-hidden className="size-[18px]" />
                          <span className="sr-only">
                            {CALENDAR_EVENT_KIND_LABELS[payment.kind]}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">{payment.title}</span>
                          <span className="text-caption text-ink-surface-muted">
                            {formatJalaliDate(new Date(payment.dueDate), {
                              style: "medium",
                            })}
                          </span>
                        </span>
                        <Money
                          rial={payment.amount}
                          className="shrink-0 font-medium"
                          unitClassName="text-ink-surface-muted"
                        />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {hidden > 0 ? (
              <li>
                <Link
                  href="/calendar"
                  className="flex h-11 items-center justify-center rounded-full bg-ink-surface-subtle text-body font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {hidden.toLocaleString("fa-IR")} پرداخت دیگر در تقویم
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * The first `max` payments across the buckets, in order, dropping buckets
 * left empty. Each bucket keeps its full total: "امروز" still says how much
 * is owed today even when only some of today's rows fit.
 */
function limitRows(buckets: UpcomingBucket[], max: number): UpcomingBucket[] {
  let room = max;

  return buckets
    .map((bucket) => {
      const shown = bucket.payments.slice(0, Math.max(0, room));
      room -= shown.length;
      return { ...bucket, payments: shown };
    })
    .filter((bucket) => bucket.payments.length > 0);
}
