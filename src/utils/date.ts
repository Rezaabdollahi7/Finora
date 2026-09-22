import {
  isValidJalaaliDate,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from "jalaali-js";

import { siteConfig } from "@/config/site";
import { toPersianDigits } from "@/utils/digits";
import { applyDigitStyle, type DigitStyle } from "@/utils/number";

/**
 * The Gregorian/Jalali conversion layer.
 *
 * Timestamps are stored in UTC and displayed in the Jalali calendar
 * (rule G.5). The two never mix: nothing here returns a `Date` that means a
 * Jalali date, and nothing accepts a Jalali value where an instant is
 * expected.
 *
 * Time zone matters more than it looks. A transaction recorded at
 * 2026-09-21T21:00Z happened on 2026-09-22 in Tehran, which is a different
 * Jalali day. Every conversion below is therefore anchored to the household's
 * time zone rather than to the server's.
 */

export const TIME_ZONE = siteConfig.timeZone;

/** A calendar date in the Jalali calendar. Months are 1-12, days 1-31. */
export type JalaliDate = { year: number; month: number; day: number };

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Weekday names, indexed the way {@link jalaliWeekday} returns them. */
export const JALALI_WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

/* -------------------------------------------------------------------------
 * Time-zone helpers
 * ---------------------------------------------------------------------- */

/** The Gregorian wall-clock date an instant falls on, in the given zone. */
export function gregorianPartsInZone(
  instant: Date,
  timeZone: string = TIME_ZONE,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: read("year"), month: read("month"), day: read("day") };
}

/** A zone's UTC offset, in minutes, at a given instant. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  // Format the instant as if it were UTC wall-clock text, then read that text
  // back as UTC. The difference is the offset — and because it is measured at
  // the instant itself, it stays correct across any future DST change.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );

  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * The instant at which a wall-clock time occurs in a time zone.
 *
 * Applied twice, because the first guess uses the offset at the wrong instant
 * whenever the guess lands on the other side of an offset change.
 */
export function zonedTimeToUtc(
  { year, month, day }: { year: number; month: number; day: number },
  { hour = 0, minute = 0, second = 0 } = {},
  timeZone: string = TIME_ZONE,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);

  let instant = new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000);
  instant = new Date(naive - zoneOffsetMinutes(instant, timeZone) * 60_000);

  return instant;
}

/* -------------------------------------------------------------------------
 * Conversion
 * ---------------------------------------------------------------------- */

/** The Jalali date an instant falls on, in the household's time zone. */
export function toJalaliDate(instant: Date, timeZone: string = TIME_ZONE): JalaliDate {
  const { year, month, day } = gregorianPartsInZone(instant, timeZone);
  const { jy, jm, jd } = toJalaali(year, month, day);

  return { year: jy, month: jm, day: jd };
}

/**
 * The instant at the start of a Jalali day, in the household's time zone.
 *
 * This is the value to store when a user picks a date: midnight in Tehran,
 * expressed in UTC.
 */
export function fromJalaliDate(
  { year, month, day }: JalaliDate,
  timeZone: string = TIME_ZONE,
): Date {
  if (!isValidJalaliDate({ year, month, day })) {
    throw new RangeError(
      `Invalid Jalali date: ${year}/${month}/${day}. Month must be 1-12 and day must exist in that month.`,
    );
  }

  const { gy, gm, gd } = toGregorian(year, month, day);
  return zonedTimeToUtc({ year: gy, month: gm, day: gd }, {}, timeZone);
}

export function isValidJalaliDate({ year, month, day }: JalaliDate): boolean {
  return isValidJalaaliDate(year, month, day);
}

/** Number of days in a Jalali month; 29 or 30 for Esfand depending on leap year. */
export function jalaliMonthLength(year: number, month: number): number {
  return jalaaliMonthLength(year, month);
}

/**
 * Weekday index for a Jalali date, 0 = Saturday .. 6 = Friday.
 *
 * The Persian week starts on Saturday, so this is deliberately not
 * `Date.getDay()`, which starts on Sunday.
 */
export function jalaliWeekday(date: JalaliDate, timeZone: string = TIME_ZONE): number {
  const instant = fromJalaliDate(date, timeZone);
  const { year, month, day } = gregorianPartsInZone(instant, timeZone);

  // Build the date in UTC so getUTCDay reflects the calendar date, not the
  // server's local zone.
  const sundayBased = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return (sundayBased + 1) % 7;
}

/* -------------------------------------------------------------------------
 * Formatting
 * ---------------------------------------------------------------------- */

export type DateFormatStyle =
  /** ۲۵ شهریور ۱۴۰۵ */
  | "long"
  /** دوشنبه ۲۵ شهریور ۱۴۰۵ */
  | "full"
  /** ۲۵ شهریور */
  | "medium"
  /** ۲۵/۰۶/۱۴۰۵ */
  | "short";

/**
 * Format an instant as a Jalali date string.
 *
 * Dates use Persian digits by default, per docs/DESIGN_SYSTEM.md §42 — unlike
 * money, which uses Latin digits for scannability (§41).
 */
export function formatJalaliDate(
  instant: Date,
  {
    style = "long",
    digits = "persian",
    timeZone = TIME_ZONE,
  }: { style?: DateFormatStyle; digits?: DigitStyle; timeZone?: string } = {},
): string {
  const date = toJalaliDate(instant, timeZone);
  const monthName = JALALI_MONTHS[date.month - 1]!;

  const pad = (value: number, width: number) => String(value).padStart(width, "0");

  switch (style) {
    case "short":
      return applyDigitStyle(
        `${pad(date.day, 2)}/${pad(date.month, 2)}/${date.year}`,
        digits,
      );
    case "medium":
      return `${applyDigitStyle(String(date.day), digits)} ${monthName}`;
    case "full": {
      const weekday = JALALI_WEEKDAYS[jalaliWeekday(date, timeZone)]!;
      return `${weekday} ${applyDigitStyle(String(date.day), digits)} ${monthName} ${applyDigitStyle(String(date.year), digits)}`;
    }
    case "long":
      return `${applyDigitStyle(String(date.day), digits)} ${monthName} ${applyDigitStyle(String(date.year), digits)}`;
  }
}

/** Format the time of day, e.g. ۱۴:۳۰. */
export function formatTime(
  instant: Date,
  {
    digits = "persian",
    timeZone = TIME_ZONE,
  }: { digits?: DigitStyle; timeZone?: string } = {},
): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);

  return applyDigitStyle(formatted, digits);
}

/** Jalali month and year, e.g. شهریور ۱۴۰۵ — for calendar and report headers. */
export function formatJalaliMonth(
  date: JalaliDate,
  { digits = "persian" }: { digits?: DigitStyle } = {},
): string {
  return `${JALALI_MONTHS[date.month - 1]!} ${applyDigitStyle(String(date.year), digits)}`;
}

/* -------------------------------------------------------------------------
 * Day arithmetic
 * ---------------------------------------------------------------------- */

/** Whole days between two instants, counted as calendar days in the zone. */
export function calendarDaysBetween(
  from: Date,
  to: Date,
  timeZone: string = TIME_ZONE,
): number {
  const startOf = (instant: Date) => {
    const { year, month, day } = gregorianPartsInZone(instant, timeZone);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round((startOf(to) - startOf(from)) / 86_400_000);
}

/**
 * A human label for a date relative to today: امروز, فردا, دیروز, or a count
 * of days. Used by upcoming-payment lists.
 */
export function formatRelativeDay(
  instant: Date,
  { now = new Date(), timeZone = TIME_ZONE }: { now?: Date; timeZone?: string } = {},
): string {
  const days = calendarDaysBetween(now, instant, timeZone);

  if (days === 0) return "امروز";
  if (days === 1) return "فردا";
  if (days === -1) return "دیروز";
  if (days > 1) return `${toPersianDigits(days)} روز دیگر`;

  return `${toPersianDigits(-days)} روز پیش`;
}

/* -------------------------------------------------------------------------
 * Jalali month arithmetic
 *
 * "This month" in a Persian household means the Jalali month, not the
 * Gregorian one. Reporting on Gregorian months would split every Persian
 * month across two report rows and put Nowruz in the middle of one.
 * ---------------------------------------------------------------------- */

/** A Jalali year and month, without a day. */
export type JalaliMonth = { year: number; month: number };

/** The Jalali month an instant falls in. */
export function jalaliMonthOf(
  instant: Date,
  timeZone: string = TIME_ZONE,
): JalaliMonth {
  const { year, month } = toJalaliDate(instant, timeZone);
  return { year, month };
}

/** Move a Jalali month by a whole number of months, in either direction. */
export function addJalaliMonths(
  { year, month }: JalaliMonth,
  delta: number,
): JalaliMonth {
  // Work in absolute months so the year rolls over correctly in both
  // directions, including past a negative remainder.
  const absolute = year * 12 + (month - 1) + delta;

  return { year: Math.floor(absolute / 12), month: (absolute % 12) + 1 };
}

/**
 * The half-open UTC interval covering a Jalali month: `[start, end)`.
 *
 * Half-open rather than inclusive so consecutive months tile the timeline
 * exactly — no instant belongs to two months, and none falls between them.
 */
export function jalaliMonthRange(
  { year, month }: JalaliMonth,
  timeZone: string = TIME_ZONE,
): { start: Date; end: Date } {
  const next = addJalaliMonths({ year, month }, 1);

  return {
    start: fromJalaliDate({ year, month, day: 1 }, timeZone),
    end: fromJalaliDate({ year: next.year, month: next.month, day: 1 }, timeZone),
  };
}

/** The last `count` Jalali months ending with `end`, oldest first. */
export function recentJalaliMonths(end: JalaliMonth, count: number): JalaliMonth[] {
  return Array.from({ length: count }, (_, index) =>
    addJalaliMonths(end, index - (count - 1)),
  );
}

/** A month label for a chart axis or a report header, e.g. شهریور ۱۴۰۵. */
export function jalaliMonthLabel(
  { year, month }: JalaliMonth,
  {
    digits = "persian",
    withYear = true,
  }: { digits?: DigitStyle; withYear?: boolean } = {},
): string {
  const name = JALALI_MONTHS[month - 1]!;
  return withYear ? `${name} ${applyDigitStyle(String(year), digits)}` : name;
}

/* -------------------------------------------------------------------------
 * Calendar grids (task 4.6)
 * ---------------------------------------------------------------------- */

/** One cell of a month grid. */
export type JalaliCalendarDay = {
  date: JalaliDate;
  /** Midnight Tehran, as the UTC instant the database stores (rule G.5). */
  instant: Date;
  /** False for the days borrowed from the months on either side. */
  inMonth: boolean;
  isToday: boolean;
  /** 0 = Saturday .. 6 = Friday. */
  weekday: number;
  /** Friday is the Persian weekend. */
  isWeekend: boolean;
};

/**
 * Six rows, always.
 *
 * A Jalali month needs five rows or six depending on which weekday it starts
 * on. Letting the grid change height makes the whole page jump every time
 * the user steps a month forward, and a calendar is a thing people page
 * through quickly.
 */
const CALENDAR_ROWS = 6;
const DAYS_IN_WEEK = 7;

/**
 * A Jalali month laid out as weeks, Saturday first (task 4.6).
 *
 * The leading and trailing cells come from the neighbouring months rather
 * than being blank, so the week rows read as real weeks — a blank Saturday
 * before the 1st of Mehr hides the fact that the 30th of Shahrivar was that
 * Saturday. They are marked `inMonth: false` so the UI can mute them.
 */
export function jalaliMonthGrid(
  { year, month }: JalaliMonth,
  now: Date = new Date(),
  timeZone: string = TIME_ZONE,
): JalaliCalendarDay[][] {
  const today = toJalaliDate(now, timeZone);
  const previous = addJalaliMonths({ year, month }, -1);
  const previousLength = jalaliMonthLength(previous.year, previous.month);
  const lead = jalaliWeekday({ year, month, day: 1 }, timeZone);

  const cells: JalaliCalendarDay[] = [];

  for (let index = 0; index < CALENDAR_ROWS * DAYS_IN_WEEK; index += 1) {
    // Days before the 1st count backwards into the previous month; days past
    // the last count forwards into the next one.
    const dayOfMonth = index - lead + 1;
    let date: JalaliDate;
    let inMonth = true;

    if (dayOfMonth < 1) {
      date = { ...previous, day: previousLength + dayOfMonth };
      inMonth = false;
    } else if (dayOfMonth > jalaliMonthLength(year, month)) {
      const next = addJalaliMonths({ year, month }, 1);
      date = { ...next, day: dayOfMonth - jalaliMonthLength(year, month) };
      inMonth = false;
    } else {
      date = { year, month, day: dayOfMonth };
    }

    const weekday = index % DAYS_IN_WEEK;

    cells.push({
      date,
      instant: fromJalaliDate(date, timeZone),
      inMonth,
      isToday:
        date.year === today.year &&
        date.month === today.month &&
        date.day === today.day,
      weekday,
      // Friday is the sixth index in a Saturday-first week.
      isWeekend: weekday === 6,
    });
  }

  return Array.from({ length: CALENDAR_ROWS }, (_, row) =>
    cells.slice(row * DAYS_IN_WEEK, (row + 1) * DAYS_IN_WEEK),
  );
}
