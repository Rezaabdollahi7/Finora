import {
  addJalaliMonths,
  calendarDaysBetween,
  fromJalaliDate,
  jalaliMonthLength,
  toJalaliDate,
} from "@/utils/date";

/**
 * Recurrence rules (tasks 5.2 and 5.3).
 *
 * Pure date arithmetic with no database, so the rule that decides when money
 * is expected can be tested directly (rule G.11).
 *
 * Monthly and yearly recurrences walk **Jalali** months and years: rent due
 * on the first is due on the first of Mehr and the first of Aban, not every
 * thirty days (rule G.5). Weekly and custom cadences are genuinely day-based
 * and step in days, because "every fortnight" means fourteen days wherever
 * the month boundary happens to fall.
 */

export const RECURRENCE_FREQUENCIES = [
  "MONTHLY",
  "WEEKLY",
  "YEARLY",
  "CUSTOM",
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  MONTHLY: "ماهانه",
  WEEKLY: "هفتگی",
  YEARLY: "سالانه",
  CUSTOM: "دوره‌ای",
};

/** The unit an interval counts, per frequency. */
export const RECURRENCE_INTERVAL_UNITS: Record<RecurrenceFrequency, string> = {
  MONTHLY: "ماه",
  WEEKLY: "هفته",
  YEARLY: "سال",
  CUSTOM: "روز",
};

/**
 * The state of one expected payment.
 *
 * Derived, never stored — for the same reason an instalment's is (see
 * features/loans/schedule): three of the four change with nothing but the
 * passage of time, so a stored value would be wrong by morning.
 */
export const OCCURRENCE_STATUSES = ["UPCOMING", "DUE", "PAID", "OVERDUE"] as const;

export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  UPCOMING: "در پیش",
  DUE: "سررسید امروز",
  PAID: "پرداخت‌شده",
  OVERDUE: "معوق",
};

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** How many units between payments. 1 is every month, 2 every other. */
  interval: number;
  startDate: Date;
  endDate: Date | null;
  /**
   * Day of the Jalali month, for MONTHLY. Null means "the day the rule
   * started on". Ignored by the other frequencies, which take their day from
   * the start date.
   */
  paymentDay: number | null;
};

/**
 * A backstop on a single call, not a limit on how long a rule may run.
 *
 * Reached only by a caller that never breaks out; the seek below means a
 * window's worth of dates is generated, not everything since the rule began.
 */
const MAX_OCCURRENCES = 2_000;

/**
 * The day a monthly payment falls on, inside a month that may be too short.
 *
 * The same rule loan instalments use: rent due on the 31st is due on the
 * 30th of Mehr rather than spilling into Aban, and each month clamps from
 * the rule's own day so one short Esfand cannot drag every later date
 * earlier with it.
 */
function clampDay(month: { year: number; month: number }, day: number): number {
  return Math.min(day, jalaliMonthLength(month.year, month.month));
}

/** The Jalali month a monthly rule first pays in, and the day it pays on. */
function monthlyAnchor(rule: RecurrenceRule) {
  const start = toJalaliDate(rule.startDate);
  const day = rule.paymentDay ?? start.day;

  // A rule started on the 20th with a payment day of the 5th first pays on
  // the 5th of the *next* month: the 5th of this one has already gone.
  const month =
    clampDay(start, day) >= start.day
      ? { year: start.year, month: start.month }
      : addJalaliMonths({ year: start.year, month: start.month }, 1);

  return { month, day };
}

/** Whole days between two instants, by the calendar rather than by hours. */
function daysBetween(from: Date, to: Date): number {
  return calendarDaysBetween(from, to);
}

/**
 * How many steps to skip to reach `from`.
 *
 * Without this, answering "what falls in Mehr 1410" for a daily rule started
 * in 1405 would mean generating every day in between — about eighteen
 * hundred dates to return thirty. Seeking makes the cost proportional to the
 * window rather than to how long ago the rule started.
 *
 * It always lands on or before the first date in range, never after: the
 * caller filters what it does not want, but nothing can put back an
 * occurrence that was skipped. The extra step of slack costs one wasted
 * iteration and is the cheap side of that trade. Overshooting by one is what
 * the cross-checks in the tests catch.
 */
function seek(rule: RecurrenceRule, from: Date): number {
  const interval = Math.max(1, rule.interval);

  if (rule.frequency === "MONTHLY") {
    const { month } = monthlyAnchor(rule);
    const target = toJalaliDate(from);
    const elapsed = (target.year - month.year) * 12 + (target.month - month.month);

    return Math.max(0, Math.floor(elapsed / interval) - 1);
  }

  if (rule.frequency === "YEARLY") {
    const start = toJalaliDate(rule.startDate);
    const elapsed = toJalaliDate(from).year - start.year;

    return Math.max(0, Math.floor(elapsed / interval) - 1);
  }

  const step = rule.frequency === "WEEKLY" ? 7 * interval : interval;
  const elapsed = daysBetween(rule.startDate, from);

  return Math.max(0, Math.floor(elapsed / step) - 1);
}

/**
 * Every date the rule produces inside a half-open window, in order.
 *
 * The window is what makes an open-ended rule finite: a monthly rent with no
 * end date has infinitely many future payments, and the only sane question
 * is which of them fall in the month being looked at. Occurrences before the
 * rule starts or after it ends are not produced at all.
 */
export function occurrencesBetween(
  rule: RecurrenceRule,
  window: { start: Date; end: Date },
): Date[] {
  const dates: Date[] = [];
  const last = rule.endDate;

  for (const date of generate(rule, seek(rule, window.start))) {
    if (last && date > last) break;
    if (date >= window.end) break;
    if (date >= window.start) dates.push(date);
  }

  return dates;
}

/**
 * The next date on or after an instant, or null once the rule has ended.
 *
 * Used for "پرداخت بعدی" on a list, where generating a window would be more
 * work than the answer is worth.
 */
export function nextOccurrenceOnOrAfter(rule: RecurrenceRule, from: Date): Date | null {
  for (const date of generate(rule, seek(rule, from))) {
    if (rule.endDate && date > rule.endDate) return null;
    if (daysBetween(from, date) >= 0) return date;
  }

  return null;
}

/**
 * The rule's dates, lazily, starting `fromIndex` steps in.
 *
 * A generator rather than an array because the sequence is open-ended: a
 * monthly rent with no end date never stops, and every caller wants a slice
 * of it.
 */
function* generate(rule: RecurrenceRule, fromIndex = 0): Generator<Date> {
  const interval = Math.max(1, rule.interval);
  const start = toJalaliDate(rule.startDate);

  if (rule.frequency === "MONTHLY") {
    const { month: first, day } = monthlyAnchor(rule);

    for (let index = fromIndex; index < fromIndex + MAX_OCCURRENCES; index += 1) {
      const month = addJalaliMonths(first, index * interval);
      yield fromJalaliDate({ ...month, day: clampDay(month, day) });
    }

    return;
  }

  if (rule.frequency === "YEARLY") {
    for (let index = fromIndex; index < fromIndex + MAX_OCCURRENCES; index += 1) {
      const year = start.year + index * interval;

      // Esfand 30th exists only in a leap year; the clamp handles it the
      // same way it handles a monthly rule.
      yield fromJalaliDate({
        year,
        month: start.month,
        day: clampDay({ year, month: start.month }, start.day),
      });
    }

    return;
  }

  // WEEKLY and CUSTOM are day counts. Stepping in days rather than months is
  // the point: a fortnightly payment is fourteen days apart wherever the
  // month boundary falls.
  const step = rule.frequency === "WEEKLY" ? 7 * interval : interval;

  for (let index = fromIndex; index < fromIndex + MAX_OCCURRENCES; index += 1) {
    const at = toJalaliDate(
      new Date(rule.startDate.getTime() + index * step * 86_400_000),
    );

    // Rebuilt from its Jalali parts so the result is midnight Tehran even
    // across a daylight-saving shift, rather than drifting an hour.
    yield fromJalaliDate(at);
  }
}

/**
 * What state an expected payment is in (task 5.4).
 *
 * Identical in shape to an instalment's, and deliberately so: to a household
 * "the rent is overdue" and "the instalment is overdue" mean the same thing,
 * and the calendar shows them side by side.
 */
export function occurrenceStatus(
  { dueDate, paidAt }: { dueDate: Date; paidAt: Date | null },
  now: Date = new Date(),
): OccurrenceStatus {
  if (paidAt) return "PAID";

  const days = calendarDaysBetween(now, dueDate);

  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE";

  return "UPCOMING";
}
