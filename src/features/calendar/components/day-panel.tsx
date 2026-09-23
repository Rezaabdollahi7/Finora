import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { INSTALLMENT_STATUS_LABELS } from "@/features/loans/schedule";
import { INSTALLMENT_STATUS_STYLE } from "@/features/loans/format";
import {
  CALENDAR_EVENT_KIND_LABELS,
  type CalendarDayEvents,
} from "@/features/calendar/types";

/**
 * What is owed on the selected day (task 4.8).
 *
 * The roadmap's own sketch: the date, the payments, the total. Each row
 * links to the thing it came from, because "قسط ۲۹ — وام مسکن" is only
 * useful if you can get to the loan and pay it.
 *
 * The total counts everything on the day; what is still unpaid is called out
 * separately, since a day whose payments are all settled and a day with
 * nothing owed are different facts.
 */
export function DayPanel({
  date,
  day,
}: {
  /** The selected day's midnight-Tehran instant. */
  date: Date;
  day: CalendarDayEvents | undefined;
}) {
  const events = day?.events ?? [];
  const unpaid = day ? BigInt(day.unpaidTotal) : 0n;

  return (
    <Card variant="featured" className="gap-6 p-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>{formatJalaliDate(date, { style: "full" })}</CardTitle>
          <CardDescription>
            {events.length === 0
              ? "پرداختی برای این روز ثبت نشده"
              : `${events.length.toLocaleString("fa-IR")} پرداخت`}
          </CardDescription>
        </div>
      </CardHeader>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="این روز خالی است"
          description="اقساط وام‌ها و پرداخت‌های دوره‌ای که سررسیدشان این روز باشد اینجا دیده می‌شوند."
        />
      ) : (
        <>
          <ul className="-mx-3 flex flex-col gap-1">
            {events.map((event) => {
              const style = INSTALLMENT_STATUS_STYLE[event.status];
              const Icon = style.icon;

              return (
                <li key={event.id}>
                  <Link
                    href={event.href}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-3 transition-colors duration-150 ease-out hover:bg-muted"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body font-medium">
                        {event.subtitle ?? event.title}
                      </span>
                      <span className="truncate text-caption text-muted-foreground">
                        {event.subtitle
                          ? event.title
                          : CALENDAR_EVENT_KIND_LABELS[event.kind]}
                      </span>
                    </span>

                    <Badge variant={style.tone} className="shrink-0">
                      <Icon />
                      {INSTALLMENT_STATUS_LABELS[event.status]}
                    </Badge>

                    <Money
                      rial={event.amount}
                      className="ms-auto font-medium"
                      unit={false}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg bg-highlight px-4 py-3 text-highlight-foreground">
            <span className="text-body font-medium">مجموع</span>
            <Money
              rial={day!.total}
              className="text-h3 font-light"
              unitClassName="text-highlight-foreground/70"
            />
          </div>

          {unpaid > 0n && unpaid !== BigInt(day!.total) ? (
            <div className="flex flex-wrap items-baseline justify-between gap-3 text-caption">
              <span className="text-muted-foreground">پرداخت‌نشده</span>
              <Money rial={day!.unpaidTotal} tone="negative" />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
