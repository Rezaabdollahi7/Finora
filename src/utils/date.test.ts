import { describe, expect, it } from "vitest";

import {
  calendarDaysBetween,
  formatJalaliDate,
  formatJalaliMonth,
  formatRelativeDay,
  formatTime,
  fromJalaliDate,
  isValidJalaliDate,
  jalaliMonthLength,
  jalaliWeekday,
  JALALI_WEEKDAYS,
  toJalaliDate,
  zonedTimeToUtc,
} from "@/utils/date";

/**
 * An independent reading of the same instant, straight from ICU's Persian
 * calendar. Cross-checking against it means the conversion layer is verified
 * by something other than the library it is built on.
 */
function icuJalali(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: read("year"), month: read("month"), day: read("day") };
}

describe("toJalaliDate", () => {
  it("converts a known date", () => {
    expect(toJalaliDate(new Date("2026-09-21T09:00:00Z"))).toEqual({
      year: 1405,
      month: 6,
      day: 30,
    });
  });

  it("agrees with ICU across four years of daily samples", () => {
    const start = Date.UTC(2024, 0, 1, 9, 0, 0);
    for (let offset = 0; offset < 365 * 4; offset += 1) {
      const instant = new Date(start + offset * 86_400_000);
      expect(toJalaliDate(instant), instant.toISOString()).toEqual(icuJalali(instant));
    }
  });

  it("agrees with ICU around the Nowruz boundary", () => {
    // 1 Farvardin 1405 falls on 2026-03-21.
    for (const iso of [
      "2026-03-19T09:00:00Z",
      "2026-03-20T09:00:00Z",
      "2026-03-21T09:00:00Z",
      "2026-03-22T09:00:00Z",
    ]) {
      const instant = new Date(iso);
      expect(toJalaliDate(instant), iso).toEqual(icuJalali(instant));
    }
  });
});

describe("time zone handling", () => {
  /*
   * The case that makes a naive implementation wrong. Tehran is UTC+03:30,
   * so 2026-09-21T21:00Z is 00:30 on 2026-09-22 in Tehran — the next Jalali
   * day. Reading the UTC date directly would file the transaction under the
   * wrong day, and therefore the wrong month's report.
   */
  it("assigns a late-evening UTC instant to the following Tehran day", () => {
    expect(toJalaliDate(new Date("2026-09-21T21:00:00Z"))).toEqual({
      year: 1405,
      month: 6,
      day: 31,
    });
    expect(toJalaliDate(new Date("2026-09-21T20:00:00Z"))).toEqual({
      year: 1405,
      month: 6,
      day: 30,
    });
  });

  it("is not affected by the server's own time zone", () => {
    // The conversion is anchored to Asia/Tehran, so passing a different zone
    // explicitly must change the answer — proving the zone is really used and
    // not quietly ignored in favour of the host's.
    const instant = new Date("2026-09-21T21:00:00Z");
    expect(toJalaliDate(instant, "UTC")).toEqual({ year: 1405, month: 6, day: 30 });
    expect(toJalaliDate(instant, "Asia/Tehran")).toEqual({
      year: 1405,
      month: 6,
      day: 31,
    });
  });

  it("zonedTimeToUtc produces midnight Tehran, which is 20:30 UTC the day before", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 9, day: 22 });
    expect(instant.toISOString()).toBe("2026-09-21T20:30:00.000Z");
  });
});

describe("fromJalaliDate", () => {
  it("stores the start of the Jalali day as a UTC instant", () => {
    // 1 Mehr 1405 is 2026-09-23; midnight in Tehran is 20:30Z the day before.
    const instant = fromJalaliDate({ year: 1405, month: 7, day: 1 });
    expect(instant.toISOString()).toBe("2026-09-22T20:30:00.000Z");
  });

  it("round-trips every day of a Jalali year", () => {
    for (let month = 1; month <= 12; month += 1) {
      for (let day = 1; day <= jalaliMonthLength(1405, month); day += 1) {
        const date = { year: 1405, month, day };
        expect(toJalaliDate(fromJalaliDate(date)), `${month}/${day}`).toEqual(date);
      }
    }
  });

  it("rejects an impossible date instead of silently rolling it over", () => {
    expect(() => fromJalaliDate({ year: 1405, month: 12, day: 30 })).toThrow(
      RangeError,
    );
    expect(() => fromJalaliDate({ year: 1405, month: 13, day: 1 })).toThrow(RangeError);
    expect(() => fromJalaliDate({ year: 1405, month: 7, day: 31 })).toThrow(RangeError);
  });
});

describe("jalaliMonthLength", () => {
  it("gives 31 days to the first six months and 30 to the next five", () => {
    for (let month = 1; month <= 6; month += 1) {
      expect(jalaliMonthLength(1405, month)).toBe(31);
    }
    for (let month = 7; month <= 11; month += 1) {
      expect(jalaliMonthLength(1405, month)).toBe(30);
    }
  });

  it("gives Esfand 29 days normally and 30 in a leap year", () => {
    expect(jalaliMonthLength(1405, 12)).toBe(29);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
  });
});

describe("isValidJalaliDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidJalaliDate({ year: 1405, month: 12, day: 29 })).toBe(true);
    expect(isValidJalaliDate({ year: 1403, month: 12, day: 30 })).toBe(true);
    expect(isValidJalaliDate({ year: 1405, month: 12, day: 30 })).toBe(false);
    expect(isValidJalaliDate({ year: 1405, month: 0, day: 1 })).toBe(false);
  });
});

describe("jalaliWeekday", () => {
  it("indexes from Saturday, not Sunday", () => {
    // 30 Shahrivar 1405 is 2026-09-21, a Monday -> دوشنبه, index 2.
    expect(jalaliWeekday({ year: 1405, month: 6, day: 30 })).toBe(2);
    expect(JALALI_WEEKDAYS[jalaliWeekday({ year: 1405, month: 6, day: 30 })]).toBe(
      "دوشنبه",
    );
  });

  it("covers a full week in order", () => {
    // 4 Mehr 1405 is 2026-09-26, a Saturday — the start of the Persian week.
    const names = Array.from(
      { length: 7 },
      (_, offset) =>
        JALALI_WEEKDAYS[jalaliWeekday({ year: 1405, month: 7, day: 4 + offset })],
    );
    expect(names).toEqual([
      "شنبه",
      "یکشنبه",
      "دوشنبه",
      "سه‌شنبه",
      "چهارشنبه",
      "پنجشنبه",
      "جمعه",
    ]);
  });
});

describe("formatJalaliDate", () => {
  const instant = new Date("2026-09-21T09:00:00Z"); // 30 Shahrivar 1405

  it("formats the design system's styles", () => {
    // docs/DESIGN_SYSTEM.md §42
    expect(formatJalaliDate(instant, { style: "long" })).toBe("۳۰ شهریور ۱۴۰۵");
    expect(formatJalaliDate(instant, { style: "medium" })).toBe("۳۰ شهریور");
    expect(formatJalaliDate(instant, { style: "short" })).toBe("۳۰/۰۶/۱۴۰۵");
    expect(formatJalaliDate(instant, { style: "full" })).toBe("دوشنبه ۳۰ شهریور ۱۴۰۵");
  });

  it("uses Persian digits by default, unlike money", () => {
    expect(formatJalaliDate(instant, { style: "long", digits: "latin" })).toBe(
      "30 شهریور 1405",
    );
  });

  it("pads the short style to two digits", () => {
    const early = new Date("2026-03-22T09:00:00Z"); // 2 Farvardin 1405
    expect(formatJalaliDate(early, { style: "short" })).toBe("۰۲/۰۱/۱۴۰۵");
  });
});

describe("formatJalaliMonth", () => {
  it("names the month and year", () => {
    expect(formatJalaliMonth({ year: 1405, month: 6, day: 1 })).toBe("شهریور ۱۴۰۵");
  });
});

describe("formatTime", () => {
  it("renders Tehran wall-clock time, not UTC", () => {
    // 09:00Z is 12:30 in Tehran.
    expect(formatTime(new Date("2026-09-21T09:00:00Z"))).toBe("۱۲:۳۰");
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days, not 24-hour spans", () => {
    // 23:00 Tehran to 01:00 Tehran the next day is two hours but one day.
    const from = new Date("2026-09-21T19:30:00Z");
    const to = new Date("2026-09-21T21:30:00Z");
    expect(calendarDaysBetween(from, to)).toBe(1);
  });

  it("is negative for the past and zero for the same day", () => {
    const a = new Date("2026-09-21T06:00:00Z");
    const b = new Date("2026-09-24T06:00:00Z");
    expect(calendarDaysBetween(a, b)).toBe(3);
    expect(calendarDaysBetween(b, a)).toBe(-3);
    expect(calendarDaysBetween(a, a)).toBe(0);
  });
});

describe("formatRelativeDay", () => {
  const now = new Date("2026-09-21T09:00:00Z");
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);

  it("names today, tomorrow and yesterday", () => {
    expect(formatRelativeDay(now, { now })).toBe("امروز");
    expect(formatRelativeDay(inDays(1), { now })).toBe("فردا");
    expect(formatRelativeDay(inDays(-1), { now })).toBe("دیروز");
  });

  it("counts further days in Persian digits", () => {
    // Matches the upcoming-payments widget in the roadmap (2.8).
    expect(formatRelativeDay(inDays(5), { now })).toBe("۵ روز دیگر");
    expect(formatRelativeDay(inDays(-3), { now })).toBe("۳ روز پیش");
  });
});
