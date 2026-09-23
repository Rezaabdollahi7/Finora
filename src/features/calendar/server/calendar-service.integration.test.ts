import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import { fromJalaliDate, toJalaliDate } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import {
  getCalendarMonth,
  getUpcomingObligations,
} from "@/features/calendar/server/calendar-service";
import { createLoanSchema, payInstallmentSchema } from "@/features/loans/schemas";
import {
  archiveLoan,
  createLoan,
  payInstallment,
} from "@/features/loans/server/loan-service";

/** Task 4.10: the calendar events, against a real database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const day = (iso: string) => {
  const { year, month, day: d } = toJalaliDate(new Date(iso));
  return `${year}/${month}/${d}`;
};

const SHAHRIVAR = { year: 1405, month: 6 };
const NOW = jalali(1405, 6, 20);

let bank: Awaited<ReturnType<typeof createAccount>>;

beforeEach(async () => {
  await resetLedger();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "500,000,000",
    }),
  );
});

afterAll(async () => {
  await resetLedger();
  await prisma.$disconnect();
});

/** Six monthly instalments due on the 5th, starting in Shahrivar. */
async function makeLoan(overrides: Record<string, unknown> = {}) {
  return createLoan(
    createLoanSchema.parse({
      name: "وام مسکن",
      provider: "بانک مسکن",
      principalAmount: "200,000,000",
      installmentAmount: "4,100,000",
      installmentCount: 6,
      startDate: jalali(1405, 6, 2),
      paymentDay: 5,
      owner: "REZA",
      accountId: bank.id,
      ...overrides,
    }),
    NOW,
  );
}

describe("getCalendarMonth (4.7)", () => {
  it("returns the month's instalments and nothing from its neighbours", async () => {
    await makeLoan();

    const month = await getCalendarMonth(SHAHRIVAR, NOW);

    expect(month.events).toHaveLength(1);
    expect(day(month.events[0]!.date)).toBe("1405/6/5");
    expect(month.label).toBe("شهریور ۱۴۰۵");
  });

  it("groups events by the Jalali day they fall on", async () => {
    // Two loans paying on the same day.
    await makeLoan();
    await makeLoan({ name: "وام خودرو", installmentAmount: "2,000,000" });

    const month = await getCalendarMonth(SHAHRIVAR, NOW);
    const days = Object.values(month.days);

    expect(days).toHaveLength(1);
    expect(days[0]!.events).toHaveLength(2);
    expect(days[0]!.total).toBe("61000000");
  });

  it("keys each day by its own midnight, not by the event's timestamp", async () => {
    await makeLoan();

    const month = await getCalendarMonth(SHAHRIVAR, NOW);
    const key = Object.keys(month.days)[0]!;

    expect(key).toBe(jalali(1405, 6, 5).toISOString());
  });

  it("totals the month and what is still unpaid separately", async () => {
    const loan = await makeLoan();
    await makeLoan({ name: "وام خودرو", installmentAmount: "2,000,000" });
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);

    const month = await getCalendarMonth(SHAHRIVAR, NOW);

    // Both instalments are in the month; only one is still owed.
    expect(month.total).toBe("61000000");
    expect(month.unpaidTotal).toBe("20000000");
  });

  it("carries each event's status, derived from the day it is read on", async () => {
    await makeLoan();

    // The 5th is behind the 20th.
    expect((await getCalendarMonth(SHAHRIVAR, NOW)).events[0]!.status).toBe("OVERDUE");
    // Read on the day itself it is simply due.
    expect(
      (await getCalendarMonth(SHAHRIVAR, jalali(1405, 6, 5))).events[0]!.status,
    ).toBe("DUE");
    // Read a week earlier it has not happened yet.
    expect(
      (await getCalendarMonth(SHAHRIVAR, jalali(1405, 5, 28))).events[0]!.status,
    ).toBe("UPCOMING");
  });

  it("marks a paid instalment paid", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);

    expect((await getCalendarMonth(SHAHRIVAR, NOW)).events[0]!.status).toBe("PAID");
  });

  it("links each event to the loan it came from", async () => {
    const loan = await makeLoan();

    expect((await getCalendarMonth(SHAHRIVAR, NOW)).events[0]!.href).toBe(
      `/loans/${loan.id}`,
    );
  });

  it("leaves an archived loan out of the calendar", async () => {
    const loan = await makeLoan();
    await archiveLoan(loan.id);

    const month = await getCalendarMonth(SHAHRIVAR, NOW);

    expect(month.events).toEqual([]);
    expect(month.days).toEqual({});
    expect(month.total).toBe("0");
  });

  it("is empty, not broken, for a month with nothing in it", async () => {
    await makeLoan();

    expect(await getCalendarMonth({ year: 1404, month: 1 }, NOW)).toMatchObject({
      events: [],
      days: {},
      total: "0",
      unpaidTotal: "0",
    });
  });

  it("does not leak an instalment into the month before or after it", async () => {
    await makeLoan();

    // Mehr's instalment is the 5th of Mehr, not of Shahrivar.
    const mehr = await getCalendarMonth({ year: 1405, month: 7 }, NOW);

    expect(mehr.events).toHaveLength(1);
    expect(day(mehr.events[0]!.date)).toBe("1405/7/5");
  });

  it("covers the whole of Esfand, including its last day", async () => {
    // A payment day past the end of Esfand clamps to the 29th, which is the
    // day a half-open month range is most likely to drop.
    await makeLoan({
      startDate: jalali(1405, 12, 1),
      paymentDay: 31,
      installmentCount: 1,
    });

    const esfand = await getCalendarMonth({ year: 1405, month: 12 }, NOW);

    expect(esfand.events).toHaveLength(1);
    expect(day(esfand.events[0]!.date)).toBe("1405/12/29");
  });
});

describe("getUpcomingObligations (4.9)", () => {
  it("lists what is still owed, soonest first", async () => {
    await makeLoan();

    const upcoming = await getUpcomingObligations(20, NOW);

    expect(upcoming).toHaveLength(6);
    expect(upcoming.map((event) => day(event.date))).toEqual([
      "1405/6/5",
      "1405/7/5",
      "1405/8/5",
      "1405/9/5",
      "1405/10/5",
      "1405/11/5",
    ]);
  });

  it("keeps an overdue instalment in the list rather than letting it fall off", async () => {
    await makeLoan();

    // Money owed last month is still owed; dropping it is how it stops being
    // noticed.
    const upcoming = await getUpcomingObligations(20, jalali(1405, 9, 1));

    expect(upcoming[0]!.status).toBe("OVERDUE");
    expect(day(upcoming[0]!.date)).toBe("1405/6/5");
  });

  it("drops an instalment once it is paid", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);

    const upcoming = await getUpcomingObligations(20, NOW);

    expect(upcoming).toHaveLength(5);
    expect(day(upcoming[0]!.date)).toBe("1405/7/5");
  });

  it("interleaves loans by date rather than listing them one after another", async () => {
    await makeLoan();
    await makeLoan({
      name: "وام خودرو",
      paymentDay: 20,
      installmentAmount: "2,000,000",
    });

    const upcoming = await getUpcomingObligations(4, NOW);

    expect(upcoming.map((event) => day(event.date))).toEqual([
      "1405/6/5",
      "1405/6/20",
      "1405/7/5",
      "1405/7/20",
    ]);
  });

  it("respects the limit", async () => {
    await makeLoan();
    expect(await getUpcomingObligations(2, NOW)).toHaveLength(2);
  });

  it("leaves an archived loan out", async () => {
    const loan = await makeLoan();
    await archiveLoan(loan.id);

    expect(await getUpcomingObligations(20, NOW)).toEqual([]);
  });
});
