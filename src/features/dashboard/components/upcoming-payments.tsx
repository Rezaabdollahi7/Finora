import { CalendarClock } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { groupUpcomingPayments } from "@/features/dashboard/upcoming";
import type { UpcomingPayment } from "@/features/dashboard/types";

/**
 * What the household owes next (task 2.8).
 *
 * Grouped into the horizons people actually plan in — today, tomorrow, this
 * week — rather than listed as dates, because "فردا" is the information and
 * the date is the detail.
 *
 * Loan instalments arrive in Sprint 4 and recurring payments in Sprint 5, so
 * there is nothing to show yet. The empty state says exactly that instead of
 * "no upcoming payments", which would read as "you owe nothing" and is not
 * something this application currently knows.
 */
export function UpcomingPayments({ payments }: { payments: UpcomingPayment[] }) {
  const buckets = groupUpcomingPayments(payments);

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>پرداخت‌های پیش‌رو</CardTitle>
          <CardDescription>اقساط و پرداخت‌های دوره‌ای</CardDescription>
        </div>
      </CardHeader>

      {buckets.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="پرداخت پیش‌رویی ثبت نشده"
          description="وام‌ها در اسپرینت ۴ و پرداخت‌های دوره‌ای در اسپرینت ۵ اضافه می‌شوند؛ پس از آن اقساط و قبض‌های پیش‌رو اینجا می‌آیند."
        />
      ) : (
        <ul className="space-y-5">
          {buckets.map((bucket) => (
            <li key={bucket.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-caption font-semibold text-muted-foreground">
                  {bucket.label}
                </h3>
                <Money
                  rial={bucket.total}
                  className="text-caption"
                  tone="muted"
                  unit={false}
                />
              </div>
              <ul className="divide-y divide-border">
                {bucket.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center gap-3 py-2.5 text-body"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{payment.title}</span>
                      <span className="text-caption text-muted-foreground">
                        {formatJalaliDate(new Date(payment.dueDate), {
                          style: "medium",
                        })}
                      </span>
                    </span>
                    <Money rial={payment.amount} className="shrink-0 font-medium" />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
