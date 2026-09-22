import "server-only";

import {
  absoluteJalaliMonth,
  formatJalaliDate,
  fromJalaliDate,
  jalaliMonthOf,
  toJalaliDate,
} from "@/utils/date";
import { formatPercent } from "@/utils/number";
import { getBudgetMonth } from "@/features/budgets/server/budget-service";
import { getUpcomingObligations } from "@/features/calendar/server/calendar-service";
import { goalFiltersSchema } from "@/features/goals/schemas";
import { listGoals } from "@/features/goals/server/goal-service";
import { getForecast } from "@/features/forecast/server/forecast-service";
import {
  countBySeverity,
  goalMilestone,
  KIND_SEVERITY,
  orderNotifications,
  type Notification,
  type NotificationSeverity,
} from "@/features/notifications/notifications";

/**
 * The notification centre (task 8.11).
 *
 * Everything here is **derived on read**, never stored. Most of these change
 * with nothing but the passage of time — an upcoming instalment becomes due
 * and then overdue while the application sits idle — so a notifications
 * table would be wrong by morning and would need a scheduled job to keep
 * honest. The same reasoning that keeps an instalment's status out of the
 * database keeps these out of it.
 *
 * Nothing is sent anywhere either. "Notification" here means a list the
 * household reads when it opens the application, which is what a self-hosted
 * tool with no accounts and no addresses can honestly offer.
 */

/** How far ahead an instalment or a payment counts as "coming up". */
const HORIZON_DAYS = 7;

const DAY = 86_400_000;

export type NotificationsDto = {
  notifications: Notification[];
  counts: Record<NotificationSeverity, number>;
};

/** Midnight Tehran of a day, as the UTC instant the database stores. */
function startOfDay(instant: Date): Date {
  return fromJalaliDate(toJalaliDate(instant));
}

export async function getNotifications(
  now: Date = new Date(),
): Promise<NotificationsDto> {
  const month = absoluteJalaliMonth(jalaliMonthOf(now));

  const [obligations, budget, goals, forecast] = await Promise.all([
    // Enough to cover a week of due dates plus anything already late; the
    // window inside is bounded, so this is one pair of queries.
    getUpcomingObligations(100, now),
    getBudgetMonth(month, now, "SHARED"),
    listGoals(goalFiltersSchema.parse({}), now),
    getForecast(1, now),
  ]);

  const notifications: Notification[] = [];
  const today = startOfDay(now);
  const horizon = new Date(today.getTime() + HORIZON_DAYS * DAY);

  /* -- instalments and recurring payments ------------------------------- */
  for (const event of obligations) {
    const date = new Date(event.date);

    if (event.status === "PAID") continue;
    if (date >= horizon) continue;

    const late = event.status === "OVERDUE";
    const recurring = event.kind === "RECURRING";

    const kind = recurring
      ? late
        ? ("RECURRING_OVERDUE" as const)
        : ("RECURRING_DUE" as const)
      : late
        ? ("INSTALLMENT_OVERDUE" as const)
        : ("INSTALLMENT_DUE" as const);

    notifications.push({
      id: `${kind}:${event.id}`,
      kind,
      severity: KIND_SEVERITY[kind],
      title: late
        ? `${event.title} — سررسید گذشته (${formatJalaliDate(date, { style: "medium" })})`
        : `${event.title} — سررسید ${formatJalaliDate(date, { style: "medium" })}`,
      amount: event.amount,
      href: event.href,
      date: event.date,
    });
  }

  /* -- budgets ----------------------------------------------------------- */
  for (const line of budget.lines) {
    if (line.state === "NORMAL") continue;

    const exceeded = line.state === "OVER";
    const kind = exceeded ? ("BUDGET_EXCEEDED" as const) : ("BUDGET_WARNING" as const);

    notifications.push({
      id: `${kind}:${line.categoryId}:${budget.month}`,
      kind,
      severity: KIND_SEVERITY[kind],
      title: exceeded
        ? `${line.categoryName} از بودجه ${budget.label} عبور کرده است`
        : `${line.categoryName} به سقف بودجه ${budget.label} نزدیک شده است`,
      // What needs covering when over, what has to last when near.
      amount: exceeded
        ? (BigInt(line.spent) - BigInt(line.available)).toString()
        : line.remaining,
      href: "/budgets",
      date: null,
    });
  }

  /* -- cash flow --------------------------------------------------------- */
  if (forecast.warning) {
    notifications.push({
      id: "CASH_SHORTFALL",
      kind: "CASH_SHORTFALL",
      severity: KIND_SEVERITY.CASH_SHORTFALL,
      title: `موجودی قابل استفاده کفاف پرداخت‌های ${forecast.warning.days.toLocaleString("fa-IR")} روز آینده را نمی‌دهد`,
      amount: forecast.warning.shortfall,
      href: "/forecast",
      date: null,
    });
  }

  /* -- goals ------------------------------------------------------------- */
  for (const goal of goals) {
    if (goal.status === "ARCHIVED") continue;

    const milestone = goalMilestone(goal.progress.ratio);
    if (milestone === null) continue;

    notifications.push({
      id: `GOAL_MILESTONE:${goal.id}:${milestone}`,
      kind: "GOAL_MILESTONE",
      severity: KIND_SEVERITY.GOAL_MILESTONE,
      title:
        milestone === 1
          ? `${goal.name} به هدف رسید`
          : // Persian digits: the rest of the sentence is Persian, and a
            // Latin "75%" in the middle of it reads as a different language.
            `${goal.name} به ${formatPercent(milestone, {
              digits: "persian",
              fractionDigits: 0,
            })} هدف رسید`,
      amount: goal.progress.currentAmount,
      href: `/goals/${goal.id}`,
      date: null,
    });
  }

  const ordered = orderNotifications(notifications);

  return { notifications: ordered, counts: countBySeverity(ordered) };
}
