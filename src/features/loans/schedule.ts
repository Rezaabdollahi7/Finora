import {
  addJalaliMonths,
  calendarDaysBetween,
  fromJalaliDate,
  jalaliMonthLength,
  toJalaliDate,
  type JalaliMonth,
} from "@/utils/date";

/**
 * Installment schedules (task 4.3).
 *
 * Pure arithmetic over dates and `bigint`, with no database, so the rules
 * that decide when money is owed can be tested directly (rule G.11).
 *
 * The schedule is **Jalali monthly**. A household that owes its instalment on
 * the fifth owes it on the fifth of Mehr and the fifth of Aban, not every
 * thirty days and not on a Gregorian date that drifts through the Persian
 * month (rule G.5).
 */

export const INSTALLMENT_STATUSES = ["UPCOMING", "DUE", "PAID", "OVERDUE"] as const;

export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  UPCOMING: "در پیش",
  DUE: "سررسید امروز",
  PAID: "پرداخت‌شده",
  OVERDUE: "معوق",
};

/** The highest day a payment can be set to. */
export const MAX_PAYMENT_DAY = 31;

/**
 * The payment day, brought inside a month that is shorter than it.
 *
 * A loan whose instalment falls on the 31st has no 31st in Mehr, which has
 * thirty days, or in Esfand, which has twenty-nine in a common year. The
 * payment moves to the last day of that month rather than spilling into the
 * next one — spilling would put two instalments in one month and none in
 * another.
 *
 * Each month is clamped from the loan's own payment day, never from the
 * previous month's result, so a single short month cannot drag every later
 * due date earlier with it.
 */
export function clampPaymentDay(
  { year, month }: JalaliMonth,
  paymentDay: number,
): number {
  return Math.min(paymentDay, jalaliMonthLength(year, month));
}

/**
 * The Jalali month the first instalment falls in.
 *
 * A loan taken out on the 15th with payments due on the 5th owes nothing on
 * the 5th of that month — that day has already passed. The first payment is
 * the first occurrence of the payment day on or after the start date.
 */
export function firstDueMonth(startDate: Date, paymentDay: number): JalaliMonth {
  const start = toJalaliDate(startDate);
  const month = { year: start.year, month: start.month };

  return clampPaymentDay(month, paymentDay) >= start.day
    ? month
    : addJalaliMonths(month, 1);
}

export type ScheduledInstallment = {
  /** 1-based, in due-date order. */
  number: number;
  /** Midnight Tehran of the Jalali due day, stored as a UTC instant (G.5). */
  dueDate: Date;
  amount: bigint;
};

/**
 * Every instalment of a loan, in order.
 *
 * Generated once, when the loan is created, and then left alone. Editing a
 * loan must not silently rewrite instalments that have already been paid
 * (rule G.4), which is why this returns a plain list rather than writing
 * anything: the service decides what may be replaced.
 */
export function buildSchedule({
  startDate,
  paymentDay,
  installmentCount,
  installmentAmount,
}: {
  startDate: Date;
  paymentDay: number;
  installmentCount: number;
  installmentAmount: bigint;
}): ScheduledInstallment[] {
  const first = firstDueMonth(startDate, paymentDay);

  return Array.from({ length: installmentCount }, (_, index) => {
    const month = addJalaliMonths(first, index);

    return {
      number: index + 1,
      dueDate: fromJalaliDate({
        ...month,
        day: clampPaymentDay(month, paymentDay),
      }),
      amount: installmentAmount,
    };
  });
}

/** The last instalment's due date — the loan's end date (task 4.1). */
export function scheduleEndDate(
  schedule: readonly ScheduledInstallment[],
): Date | null {
  return schedule[schedule.length - 1]?.dueDate ?? null;
}

/**
 * What state an instalment is in (task 4.3).
 *
 * Derived, never stored. Three of the four states change with nothing but
 * the passage of time: an UPCOMING instalment becomes DUE and then OVERDUE
 * while the application sits idle, and no write happens to record it. A
 * stored status would be wrong by morning and would need a scheduled job to
 * keep honest. Only the fact that decides PAID — when it was paid — is a
 * column.
 */
export function installmentStatus(
  { dueDate, paidAt }: { dueDate: Date; paidAt: Date | null },
  now: Date = new Date(),
): InstallmentStatus {
  if (paidAt) return "PAID";

  const days = calendarDaysBetween(now, dueDate);

  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE";

  return "UPCOMING";
}
