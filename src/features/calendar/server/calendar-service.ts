import "server-only";

import { prisma } from "@/lib/prisma";
import {
  fromJalaliDate,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
  toJalaliDate,
  type JalaliMonth,
} from "@/utils/date";
import { sumRial } from "@/utils/money";
import { installmentStatus } from "@/features/loans/schedule";
import type {
  CalendarDayEvents,
  CalendarEvent,
  CalendarMonth,
} from "@/features/calendar/types";

/**
 * The financial calendar (tasks 4.7 and 4.8).
 *
 * Every dated obligation the household has, in one place. Loan instalments
 * are the only source today; recurring payments, bills and goal
 * contributions arrive in Sprints 5 and 6 and join here, which is why the
 * event shape is a union rather than an instalment.
 *
 * Archived loans are excluded throughout: an archived loan is one the
 * household has put away, and its dates are not obligations any more.
 */

/** One query, bounded to the window, whatever the month contains. */
async function loadInstallments(range: { start: Date; end: Date }) {
  return prisma.installment.findMany({
    where: {
      dueDate: { gte: range.start, lt: range.end },
      loan: { status: { not: "ARCHIVED" } },
    },
    select: {
      id: true,
      number: true,
      dueDate: true,
      amount: true,
      paidAt: true,
      loan: {
        select: { id: true, name: true, provider: true, installmentCount: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });
}

type InstallmentRow = Awaited<ReturnType<typeof loadInstallments>>[number];

function toEvent(row: InstallmentRow, now: Date): CalendarEvent {
  return {
    id: row.id,
    kind: "LOAN_INSTALLMENT",
    title: `قسط ${row.number.toLocaleString("fa-IR")} از ${row.loan.installmentCount.toLocaleString("fa-IR")}`,
    subtitle: row.loan.name,
    amount: row.amount.toString(),
    date: row.dueDate.toISOString(),
    status: installmentStatus(row, now),
    href: `/loans/${row.loan.id}`,
  };
}

/**
 * Bucket events by the **Jalali day** they fall on.
 *
 * Keyed by the day's own midnight-Tehran instant rather than by the event's
 * timestamp, so two obligations on the same day land in the same bucket even
 * if one was recorded at a different hour (rule G.5).
 */
function byDay(events: CalendarEvent[]): Record<string, CalendarDayEvents> {
  const days: Record<string, CalendarDayEvents> = {};

  for (const event of events) {
    const key = fromJalaliDate(toJalaliDate(new Date(event.date))).toISOString();
    const day = (days[key] ??= { date: key, events: [], total: "0", unpaidTotal: "0" });

    day.events.push(event);
  }

  for (const day of Object.values(days)) {
    day.total = sumRial(day.events.map((event) => BigInt(event.amount))).toString();
    day.unpaidTotal = sumRial(
      day.events
        .filter((event) => event.status !== "PAID")
        .map((event) => BigInt(event.amount)),
    ).toString();
  }

  return days;
}

/** Every obligation in a Jalali month, grouped by day (tasks 4.7, 4.8). */
export async function getCalendarMonth(
  month: JalaliMonth = jalaliMonthOf(new Date()),
  now: Date = new Date(),
): Promise<CalendarMonth> {
  const range = jalaliMonthRange(month);
  const rows = await loadInstallments(range);
  const events = rows.map((row) => toEvent(row, now));

  return {
    ...month,
    label: jalaliMonthLabel(month),
    days: byDay(events),
    events,
    total: sumRial(events.map((event) => BigInt(event.amount))).toString(),
    unpaidTotal: sumRial(
      events
        .filter((event) => event.status !== "PAID")
        .map((event) => BigInt(event.amount)),
    ).toString(),
  };
}

/**
 * What the household still owes, soonest first (task 4.9).
 *
 * Overdue instalments are included rather than filtered out by a "from now
 * on" window: money that was owed last week is still owed, and leaving it
 * out of the upcoming list is how it stops being noticed. The bucketing in
 * features/dashboard/upcoming puts them under "today" for the same reason.
 */
export async function getUpcomingObligations(
  limit = 20,
  now: Date = new Date(),
): Promise<CalendarEvent[]> {
  const rows = await prisma.installment.findMany({
    where: { paidAt: null, loan: { status: { not: "ARCHIVED" } } },
    select: {
      id: true,
      number: true,
      dueDate: true,
      amount: true,
      paidAt: true,
      loan: {
        select: { id: true, name: true, provider: true, installmentCount: true },
      },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  return rows.map((row) => toEvent(row, now));
}
