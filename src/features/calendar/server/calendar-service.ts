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
import { occurrencesForWindow } from "@/features/recurring/server/recurring-service";
import type { OccurrenceDto } from "@/features/recurring/types";
import type {
  CalendarDayEvents,
  CalendarEvent,
  CalendarMonth,
} from "@/features/calendar/types";

/**
 * The financial calendar (tasks 4.7 and 4.8).
 *
 * Every dated obligation the household has, in one place: loan instalments
 * and recurring payments today, goal contributions in Sprint 6. The event
 * shape is a union rather than an instalment precisely so a new source is a
 * new `toEvent`, not a new shape travelling through three components.
 *
 * Archived loans and inactive rules are excluded throughout: both are things
 * the household has put away, and their dates are not obligations any more.
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

/**
 * A recurring payment's occurrence as a calendar event.
 *
 * An expected occurrence has no row and therefore no id of its own, so the
 * event is keyed by the rule and the date — which is exactly what identifies
 * it everywhere else too.
 */
function occurrenceToEvent(occurrence: OccurrenceDto): CalendarEvent {
  return {
    id: occurrence.id ?? `${occurrence.recurringPaymentId}:${occurrence.dueDate}`,
    kind: "RECURRING",
    title: occurrence.name,
    subtitle: null,
    amount: occurrence.amount,
    date: occurrence.dueDate,
    status: occurrence.status,
    href: `/recurring/${occurrence.recurringPaymentId}`,
  };
}

/** Every obligation in a Jalali month, grouped by day (tasks 4.7, 4.8). */
export async function getCalendarMonth(
  month: JalaliMonth = jalaliMonthOf(new Date()),
  now: Date = new Date(),
): Promise<CalendarMonth> {
  const range = jalaliMonthRange(month);

  const [rows, occurrences] = await Promise.all([
    loadInstallments(range),
    occurrencesForWindow(range, now),
  ]);

  const events = [
    ...rows.map((row) => toEvent(row, now)),
    ...occurrences.map(occurrenceToEvent),
  ].sort((a, b) => a.date.localeCompare(b.date));

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
  // A rule is open-ended, so "everything still owed" is infinite. The window
  // is what makes it finite: far enough back to keep an arrear visible, far
  // enough forward to fill the horizons the widget groups by.
  const window = {
    start: new Date(now.getTime() - 365 * 86_400_000),
    end: new Date(now.getTime() + 120 * 86_400_000),
  };

  const [rows, occurrences] = await Promise.all([
    prisma.installment.findMany({
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
    }),
    occurrencesForWindow(window, now),
  ]);

  return [
    ...rows.map((row) => toEvent(row, now)),
    ...occurrences
      .filter((occurrence) => occurrence.status !== "PAID")
      .map(occurrenceToEvent),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
