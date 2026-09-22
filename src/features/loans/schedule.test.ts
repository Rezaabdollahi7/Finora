import { describe, expect, it } from "vitest";

import { fromJalaliDate, toJalaliDate } from "@/utils/date";
import {
  buildSchedule,
  clampPaymentDay,
  firstDueMonth,
  installmentStatus,
  scheduleEndDate,
} from "@/features/loans/schedule";

/** A Jalali date as the instant the application stores. */
const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

/** A due date read back as its Jalali parts, which is how it is checked. */
const parts = (instant: Date) => {
  const { year, month, day } = toJalaliDate(instant);
  return `${year}/${month}/${day}`;
};

describe("clampPaymentDay", () => {
  it("leaves a day that exists alone", () => {
    expect(clampPaymentDay({ year: 1405, month: 1 }, 15)).toBe(15);
  });

  it("brings the 31st inside a thirty-day month", () => {
    // Mehr through Esfand have thirty days or fewer.
    expect(clampPaymentDay({ year: 1405, month: 7 }, 31)).toBe(30);
  });

  it("brings the 30th inside a common-year Esfand", () => {
    // 1405 is not a leap year, so Esfand has twenty-nine days.
    expect(clampPaymentDay({ year: 1405, month: 12 }, 30)).toBe(29);
  });

  it("keeps the 30th in a leap-year Esfand", () => {
    // 1403 is a leap year.
    expect(clampPaymentDay({ year: 1403, month: 12 }, 30)).toBe(30);
  });

  it("keeps the 31st in the first six months, which have thirty-one days", () => {
    for (const month of [1, 2, 3, 4, 5, 6]) {
      expect(clampPaymentDay({ year: 1405, month }, 31)).toBe(31);
    }
  });
});

describe("firstDueMonth", () => {
  it("is the start month when the payment day is still ahead", () => {
    expect(firstDueMonth(jalali(1405, 6, 2), 5)).toEqual({ year: 1405, month: 6 });
  });

  it("is the start month when the loan starts on the payment day itself", () => {
    expect(firstDueMonth(jalali(1405, 6, 5), 5)).toEqual({ year: 1405, month: 6 });
  });

  it("moves to the next month when the payment day has already passed", () => {
    // Nothing is owed on a day that is behind the loan's own start.
    expect(firstDueMonth(jalali(1405, 6, 15), 5)).toEqual({ year: 1405, month: 7 });
  });

  it("rolls into the next year from Esfand", () => {
    expect(firstDueMonth(jalali(1405, 12, 20), 5)).toEqual({ year: 1406, month: 1 });
  });

  it("counts a clamped payment day as reachable", () => {
    // The 31st of Mehr is the 30th; a loan started on the 30th owes that day.
    expect(firstDueMonth(jalali(1405, 7, 30), 31)).toEqual({ year: 1405, month: 7 });
  });
});

describe("buildSchedule", () => {
  const schedule = buildSchedule({
    startDate: jalali(1405, 6, 2),
    paymentDay: 5,
    installmentCount: 6,
    installmentAmount: 41_000_000n,
  });

  it("generates one instalment per month, numbered in order", () => {
    expect(schedule).toHaveLength(6);
    expect(schedule.map((entry) => entry.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("walks Jalali months, not thirty-day steps", () => {
    expect(schedule.map((entry) => parts(entry.dueDate))).toEqual([
      "1405/6/5",
      "1405/7/5",
      "1405/8/5",
      "1405/9/5",
      "1405/10/5",
      "1405/11/5",
    ]);
  });

  it("gives every instalment the same amount", () => {
    expect(schedule.every((entry) => entry.amount === 41_000_000n)).toBe(true);
  });

  it("clamps a short month without dragging the months after it", () => {
    const monthly = buildSchedule({
      startDate: jalali(1405, 6, 1),
      paymentDay: 31,
      installmentCount: 8,
      installmentAmount: 1n,
    });

    // Shahrivar has 31, Mehr through Bahman have 30, Esfand 29 in 1405 — and
    // Farvardin is back to 31, because each month is clamped from the loan's
    // payment day rather than from the month before it.
    expect(monthly.map((entry) => parts(entry.dueDate))).toEqual([
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

  it("crosses the new year without losing a month", () => {
    const crossing = buildSchedule({
      startDate: jalali(1405, 11, 1),
      paymentDay: 10,
      installmentCount: 4,
      installmentAmount: 1n,
    });

    expect(crossing.map((entry) => parts(entry.dueDate))).toEqual([
      "1405/11/10",
      "1405/12/10",
      "1406/1/10",
      "1406/2/10",
    ]);
  });

  it("handles a loan long enough to pass a leap year", () => {
    // 120 monthly instalments is ten Jalali years.
    const long = buildSchedule({
      startDate: jalali(1400, 1, 1),
      paymentDay: 30,
      installmentCount: 120,
      installmentAmount: 1n,
    });

    expect(long).toHaveLength(120);
    expect(parts(long[0]!.dueDate)).toBe("1400/1/30");
    expect(parts(long[119]!.dueDate)).toBe("1409/12/29");

    // Esfand is the month that moves: 1403 and 1408 are leap years and keep
    // the 30th; every other Esfand in the run clamps to the 29th. Ten years
    // of instalments therefore contain both answers, and each is decided by
    // its own year rather than inherited from the one before.
    const esfands = long
      .filter((entry) => toJalaliDate(entry.dueDate).month === 12)
      .map((entry) => parts(entry.dueDate));

    expect(esfands).toEqual([
      "1400/12/29",
      "1401/12/29",
      "1402/12/29",
      "1403/12/30",
      "1404/12/29",
      "1405/12/29",
      "1406/12/29",
      "1407/12/29",
      "1408/12/30",
      "1409/12/29",
    ]);
  });

  it("is empty for a loan with no instalments", () => {
    expect(
      buildSchedule({
        startDate: jalali(1405, 6, 1),
        paymentDay: 5,
        installmentCount: 0,
        installmentAmount: 1n,
      }),
    ).toEqual([]);
  });

  it("stores each due date as midnight Tehran, never a Jalali value", () => {
    expect(schedule[0]!.dueDate).toBeInstanceOf(Date);
    expect(schedule[0]!.dueDate.toISOString()).toBe(jalali(1405, 6, 5).toISOString());
  });
});

describe("scheduleEndDate", () => {
  it("is the last instalment's due date", () => {
    const schedule = buildSchedule({
      startDate: jalali(1405, 6, 2),
      paymentDay: 5,
      installmentCount: 3,
      installmentAmount: 1n,
    });

    expect(parts(scheduleEndDate(schedule)!)).toBe("1405/8/5");
  });

  it("is null when there is nothing scheduled", () => {
    expect(scheduleEndDate([])).toBeNull();
  });
});

describe("installmentStatus", () => {
  const due = jalali(1405, 6, 5);

  it("is PAID whenever it was paid, however late", () => {
    expect(
      installmentStatus(
        { dueDate: due, paidAt: jalali(1405, 9, 1) },
        jalali(1405, 10, 1),
      ),
    ).toBe("PAID");
  });

  it("is DUE on the day itself", () => {
    expect(installmentStatus({ dueDate: due, paidAt: null }, due)).toBe("DUE");
  });

  it("is DUE at any hour of the day it falls on", () => {
    const lateEvening = new Date(due.getTime() + 20 * 3_600_000);
    expect(installmentStatus({ dueDate: due, paidAt: null }, lateEvening)).toBe("DUE");
  });

  it("is UPCOMING before the day", () => {
    expect(installmentStatus({ dueDate: due, paidAt: null }, jalali(1405, 6, 4))).toBe(
      "UPCOMING",
    );
  });

  it("is OVERDUE the day after", () => {
    expect(installmentStatus({ dueDate: due, paidAt: null }, jalali(1405, 6, 6))).toBe(
      "OVERDUE",
    );
  });
});
