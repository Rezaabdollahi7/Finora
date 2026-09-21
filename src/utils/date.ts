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
