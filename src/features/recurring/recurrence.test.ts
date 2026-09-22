import { describe, expect, it } from "vitest";

import { fromJalaliDate, toJalaliDate } from "@/utils/date";
import {
  nextOccurrenceOnOrAfter,
  occurrenceStatus,
  occurrencesBetween,
  type RecurrenceRule,
} from "@/features/recurring/recurrence";

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const parts = (instant: Date) => {
  const { year, month, day } = toJalaliDate(instant);
  return `${year}/${month}/${day}`;
};

const rule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  frequency: "MONTHLY",
  interval: 1,
  startDate: jalali(1405, 6, 1),
  endDate: null,
  paymentDay: 1,
  ...overrides,
});

/** A year from the start, which is wider than any test here needs. */
const YEAR = { start: jalali(1405, 1, 1), end: jalali(1406, 7, 1) };

const dates = (r: RecurrenceRule, window = YEAR) =>
  occurrencesBetween(r, window).map(parts);

describe("monthly (5.2)", () => {
  it("walks Jalali months, not thirty-day steps", () => {
    expect(
      dates(rule(), { start: jalali(1405, 6, 1), end: jalali(1405, 11, 1) }),
    ).toEqual(["1405/6/1", "1405/7/1", "1405/8/1", "1405/9/1", "1405/10/1"]);
  });

  it("honours an interval of more than one month", () => {
    expect(
      dates(rule({ interval: 2 }), {
        start: jalali(1405, 6, 1),
        end: jalali(1406, 1, 1),
      }),
    ).toEqual(["1405/6/1", "1405/8/1", "1405/10/1", "1405/12/1"]);
  });

  it("clamps a payment day the month is too short for", () => {
    const monthly = dates(rule({ paymentDay: 31, startDate: jalali(1405, 6, 1) }), {
      start: jalali(1405, 6, 1),
      end: jalali(1406, 2, 1),
    });

    // Shahrivar has 31; Mehr through Bahman 30; Esfand 29 in 1405; Farvardin
    // is back to 31, because each month clamps from the rule's own day.
    expect(monthly).toEqual([
      "1405/6/31",
      "1405/7/30",
      "1405/8/30",
      "1405/9/30",
      "1405/10/30",
      "1405/11/30",
      "1405/12/29",
      "1406/1/31",
    ]);
  });

  it("starts next month when this month's day has already passed", () => {
    expect(
      dates(rule({ startDate: jalali(1405, 6, 20), paymentDay: 5 }), {
        start: jalali(1405, 6, 1),
        end: jalali(1405, 9, 1),
      }),
    ).toEqual(["1405/7/5", "1405/8/5"]);
  });

  it("takes its day from the start date when none is given", () => {
    expect(
      dates(rule({ startDate: jalali(1405, 6, 12), paymentDay: null }), {
        start: jalali(1405, 6, 1),
        end: jalali(1405, 9, 1),
      }),
    ).toEqual(["1405/6/12", "1405/7/12", "1405/8/12"]);
  });
});

describe("weekly (5.2)", () => {
  it("steps seven days at a time", () => {
    expect(
      dates(rule({ frequency: "WEEKLY", startDate: jalali(1405, 6, 1) }), {
        start: jalali(1405, 6, 1),
        end: jalali(1405, 7, 1),
      }),
    ).toEqual(["1405/6/1", "1405/6/8", "1405/6/15", "1405/6/22", "1405/6/29"]);
  });

  it("crosses the month boundary in days rather than snapping to it", () => {
    // Shahrivar has 31 days, so the week after the 29th is the 5th of Mehr.
    const weekly = occurrencesBetween(
      rule({ frequency: "WEEKLY", startDate: jalali(1405, 6, 29) }),
      { start: jalali(1405, 6, 1), end: jalali(1405, 7, 20) },
    );

    expect(weekly.map(parts)).toEqual([
      "1405/6/29",
      "1405/7/5",
      "1405/7/12",
      "1405/7/19",
    ]);
  });

  it("honours a fortnightly interval", () => {
    expect(
      dates(rule({ frequency: "WEEKLY", interval: 2, startDate: jalali(1405, 6, 1) }), {
        start: jalali(1405, 6, 1),
        end: jalali(1405, 7, 1),
      }),
    ).toEqual(["1405/6/1", "1405/6/15", "1405/6/29"]);
  });
});

describe("yearly (5.2)", () => {
  it("repeats the same Jalali day each year", () => {
    expect(
      dates(rule({ frequency: "YEARLY", startDate: jalali(1405, 4, 10) }), {
        start: jalali(1405, 1, 1),
        end: jalali(1408, 1, 1),
      }),
    ).toEqual(["1405/4/10", "1406/4/10", "1407/4/10"]);
  });

  it("clamps the 30th of Esfand to the 29th outside a leap year", () => {
    // 1403 and 1408 are leap years; the years between are not.
    expect(
      dates(rule({ frequency: "YEARLY", startDate: jalali(1403, 12, 30) }), {
        start: jalali(1403, 1, 1),
        end: jalali(1409, 1, 1),
      }),
    ).toEqual([
      "1403/12/30",
      "1404/12/29",
      "1405/12/29",
      "1406/12/29",
      "1407/12/29",
      "1408/12/30",
    ]);
  });
});

describe("custom (5.2)", () => {
  it("steps the given number of days", () => {
    expect(
      dates(
        rule({ frequency: "CUSTOM", interval: 10, startDate: jalali(1405, 6, 1) }),
        {
          start: jalali(1405, 6, 1),
          end: jalali(1405, 7, 15),
        },
      ),
      // Shahrivar has 31 days, so ten days after the 31st is the 10th of
      // Mehr — a day count, not a month step.
    ).toEqual(["1405/6/1", "1405/6/11", "1405/6/21", "1405/6/31", "1405/7/10"]);
  });

  it("treats an interval below one as every day rather than looping forever", () => {
    const daily = occurrencesBetween(
      rule({ frequency: "CUSTOM", interval: 0, startDate: jalali(1405, 6, 1) }),
      { start: jalali(1405, 6, 1), end: jalali(1405, 6, 5) },
    );

    expect(daily.map(parts)).toEqual(["1405/6/1", "1405/6/2", "1405/6/3", "1405/6/4"]);
  });
});

describe("windows and end dates (5.3)", () => {
  it("produces nothing before the rule starts", () => {
    expect(
      dates(rule({ startDate: jalali(1405, 6, 1) }), {
        start: jalali(1405, 1, 1),
        end: jalali(1405, 6, 1),
      }),
    ).toEqual([]);
  });

  it("stops at the end date", () => {
    expect(
      dates(rule({ startDate: jalali(1405, 6, 1), endDate: jalali(1405, 8, 1) }), {
        start: jalali(1405, 1, 1),
        end: jalali(1406, 1, 1),
      }),
    ).toEqual(["1405/6/1", "1405/7/1", "1405/8/1"]);
  });

  it("includes an occurrence falling exactly on the end date", () => {
    expect(
      dates(rule({ startDate: jalali(1405, 6, 1), endDate: jalali(1405, 7, 1) }), {
        start: jalali(1405, 1, 1),
        end: jalali(1406, 1, 1),
      }),
    ).toEqual(["1405/6/1", "1405/7/1"]);
  });

  it("is half-open at the window's end, so months tile without overlap", () => {
    const shahrivar = dates(rule(), {
      start: jalali(1405, 6, 1),
      end: jalali(1405, 7, 1),
    });
    const mehr = dates(rule(), { start: jalali(1405, 7, 1), end: jalali(1405, 8, 1) });

    expect(shahrivar).toEqual(["1405/6/1"]);
    expect(mehr).toEqual(["1405/7/1"]);
  });

  it("answers a far-future window without materialising everything before it", () => {
    // An open-ended rule has infinitely many payments; asking about one month
    // five years out must still return just that month's.
    expect(
      dates(rule({ startDate: jalali(1405, 6, 1) }), {
        start: jalali(1410, 6, 1),
        end: jalali(1410, 7, 1),
      }),
    ).toEqual(["1410/6/1"]);
  });
});

describe("nextOccurrenceOnOrAfter", () => {
  it("finds today's payment rather than skipping past it", () => {
    expect(parts(nextOccurrenceOnOrAfter(rule(), jalali(1405, 7, 1))!)).toBe(
      "1405/7/1",
    );
  });

  it("finds the next one when today is not a payment day", () => {
    expect(parts(nextOccurrenceOnOrAfter(rule(), jalali(1405, 7, 2))!)).toBe(
      "1405/8/1",
    );
  });

  it("looks back to the first unpaid date when the rule started long ago", () => {
    expect(parts(nextOccurrenceOnOrAfter(rule(), jalali(1405, 3, 1))!)).toBe(
      "1405/6/1",
    );
  });

  it("is null once the rule has ended", () => {
    expect(
      nextOccurrenceOnOrAfter(
        rule({ endDate: jalali(1405, 8, 1) }),
        jalali(1405, 9, 1),
      ),
    ).toBeNull();
  });
});

describe("occurrenceStatus (5.4)", () => {
  const due = jalali(1405, 6, 5);

  it("is PAID whenever it was paid, however late", () => {
    expect(
      occurrenceStatus(
        { dueDate: due, paidAt: jalali(1405, 9, 1) },
        jalali(1405, 10, 1),
      ),
    ).toBe("PAID");
  });

  it("is DUE on the day, at any hour of it", () => {
    expect(occurrenceStatus({ dueDate: due, paidAt: null }, due)).toBe("DUE");
    expect(
      occurrenceStatus(
        { dueDate: due, paidAt: null },
        new Date(due.getTime() + 20 * 3_600_000),
      ),
    ).toBe("DUE");
  });

  it("is UPCOMING before and OVERDUE after", () => {
    expect(occurrenceStatus({ dueDate: due, paidAt: null }, jalali(1405, 6, 4))).toBe(
      "UPCOMING",
    );
    expect(occurrenceStatus({ dueDate: due, paidAt: null }, jalali(1405, 6, 6))).toBe(
      "OVERDUE",
    );
  });
});

describe("seeking to a distant window (5.3)", () => {
  /*
   * A rule is open-ended, so answering "what falls in this month" five years
   * out must not mean generating every date in between. The seek that makes
   * that cheap is also the thing most likely to skip an occurrence, so these
   * check the seek against the same answer computed the slow way.
   */
  const slowly = (r: RecurrenceRule, window: { start: Date; end: Date }) => {
    // Walk from the rule's start in small windows, which never seeks far.
    const all: string[] = [];
    let cursor = r.startDate;

    while (cursor < window.end) {
      const step = new Date(cursor.getTime() + 60 * 86_400_000);
      all.push(...occurrencesBetween(r, { start: cursor, end: step }).map(parts));
      cursor = step;
    }

    return all.filter((date) => {
      const [y, m, d] = date.split("/").map(Number);
      const at = jalali(y!, m!, d!);
      return at >= window.start && at < window.end;
    });
  };

  const distant = { start: jalali(1410, 6, 1), end: jalali(1410, 7, 1) };

  it("a daily rule five years on returns that month and nothing else", () => {
    const daily = rule({
      frequency: "CUSTOM",
      interval: 1,
      startDate: jalali(1405, 6, 1),
    });

    const found = dates(daily, distant);

    // Shahrivar has 31 days.
    expect(found).toHaveLength(31);
    expect(found[0]).toBe("1410/6/1");
    expect(found[30]).toBe("1410/6/31");
    expect(found).toEqual(slowly(daily, distant));
  });

  it("a weekly rule agrees with the same answer reached the slow way", () => {
    const weekly = rule({ frequency: "WEEKLY", startDate: jalali(1405, 6, 3) });
    expect(dates(weekly, distant)).toEqual(slowly(weekly, distant));
  });

  it("a monthly rule agrees, including one that skips months", () => {
    for (const interval of [1, 2, 3]) {
      const monthly = rule({ interval, startDate: jalali(1405, 6, 1) });
      expect(dates(monthly, distant)).toEqual(slowly(monthly, distant));
    }
  });

  it("a yearly rule agrees", () => {
    const yearly = rule({ frequency: "YEARLY", startDate: jalali(1405, 6, 9) });
    expect(dates(yearly, distant)).toEqual(slowly(yearly, distant));
  });

  it("finds the next payment of a long-running daily rule", () => {
    const daily = rule({
      frequency: "CUSTOM",
      interval: 1,
      startDate: jalali(1405, 6, 1),
    });

    expect(parts(nextOccurrenceOnOrAfter(daily, jalali(1410, 6, 15))!)).toBe(
      "1410/6/15",
    );
  });
});
