import { describe, expect, it } from "vitest";

import {
  createLoanSchema,
  loanFiltersSchema,
  payInstallmentSchema,
  updateLoanSchema,
} from "@/features/loans/schemas";

/**
 * Task 4.10, input side.
 *
 * The schemas are the only gate between what a person types and the
 * database, and they run without one, which is the point: a rule that only
 * fails at the CHECK constraint is a rule the user meets as a 500.
 */

const valid = {
  name: "وام مسکن",
  provider: "بانک مسکن",
  principalAmount: "500,000,000",
  interestRate: "23",
  installmentAmount: "8,200,000",
  installmentCount: 120,
  startDate: "2026-03-20T00:00:00.000Z",
  paymentDay: 5,
  owner: "REZA",
};

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("createLoanSchema", () => {
  it("converts the money to Rial and the rate to basis points", () => {
    const parsed = createLoanSchema.parse(valid);

    expect(parsed.principalAmount).toBe(5_000_000_000n);
    expect(parsed.installmentAmount).toBe(82_000_000n);
    expect(parsed.interestRate).toBe(2300);
    expect(parsed.startDate).toBeInstanceOf(Date);
  });

  it("keeps a fractional rate exact as an integer", () => {
    // 18.5% is 1850 basis points, not 1849.9999999999998.
    expect(
      createLoanSchema.parse({ ...valid, interestRate: "18.5" }).interestRate,
    ).toBe(1850);
  });

  it("accepts Persian digits in the amounts and the rate", () => {
    const parsed = createLoanSchema.parse({
      ...valid,
      principalAmount: "۵۰۰٬۰۰۰٬۰۰۰",
      interestRate: "۲۳٫۵",
    });

    expect(parsed.principalAmount).toBe(5_000_000_000n);
    expect(parsed.interestRate).toBe(2350);
  });

  it("defaults the rate to zero, for an interest-free family loan", () => {
    const { interestRate, ...rest } = valid;
    void interestRate;

    expect(createLoanSchema.parse(rest).interestRate).toBe(0);
  });

  it("rejects a negative rate and an implausible one", () => {
    expect(createLoanSchema.safeParse({ ...valid, interestRate: "-5" }).success).toBe(
      false,
    );
    expect(
      messages(createLoanSchema.safeParse({ ...valid, interestRate: "250" })),
    ).toContain("نرخ سود نمی‌تواند بیشتر از ۱۰۰ درصد باشد.");
  });

  it("rejects an instalment of nothing", () => {
    expect(
      messages(createLoanSchema.safeParse({ ...valid, installmentAmount: "0" })),
    ).toContain("مبلغ قسط باید بزرگ‌تر از صفر باشد.");
  });

  it("accepts a principal of zero, for a debt that was never a cash advance", () => {
    expect(
      createLoanSchema.parse({ ...valid, principalAmount: "0" }).principalAmount,
    ).toBe(0n);
  });

  it("rejects a loan with no instalments", () => {
    expect(createLoanSchema.safeParse({ ...valid, installmentCount: 0 }).success).toBe(
      false,
    );
  });

  it("rejects a fractional instalment count", () => {
    expect(
      createLoanSchema.safeParse({ ...valid, installmentCount: 4.5 }).success,
    ).toBe(false);
  });

  it("rejects a schedule longer than a working lifetime", () => {
    // 480 monthly payments is forty years; beyond that it is a typo.
    expect(
      createLoanSchema.safeParse({ ...valid, installmentCount: 481 }).success,
    ).toBe(false);
  });

  it("accepts every day of a Jalali month, including the 31st", () => {
    for (const paymentDay of [1, 15, 29, 30, 31]) {
      expect(createLoanSchema.parse({ ...valid, paymentDay }).paymentDay).toBe(
        paymentDay,
      );
    }
  });

  it("rejects a day that is not one", () => {
    // 31 is allowed and clamped per month by the schedule builder; 0 and 32
    // are not days at all.
    expect(createLoanSchema.safeParse({ ...valid, paymentDay: 0 }).success).toBe(false);
    expect(createLoanSchema.safeParse({ ...valid, paymentDay: 32 }).success).toBe(
      false,
    );
  });

  it("requires a name, a provider and an owner", () => {
    expect(createLoanSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
    expect(createLoanSchema.safeParse({ ...valid, provider: "" }).success).toBe(false);
    expect(createLoanSchema.safeParse({ ...valid, owner: "" }).success).toBe(false);
  });

  it("rejects an unreadable date rather than defaulting to today", () => {
    expect(
      messages(createLoanSchema.safeParse({ ...valid, startDate: "دیروز" })),
    ).toContain("تاریخ نامعتبر است.");
  });

  it("turns blank optional fields into null", () => {
    const parsed = createLoanSchema.parse({ ...valid, notes: "  " });

    expect(parsed.notes).toBeNull();
    expect(parsed.categoryId).toBeNull();
    expect(parsed.accountId).toBeNull();
  });
});

describe("updateLoanSchema", () => {
  it("accepts any subset", () => {
    expect(updateLoanSchema.parse({ name: "وام نو" })).toEqual({ name: "وام نو" });
  });

  it("rejects an update that changes nothing", () => {
    expect(messages(updateLoanSchema.safeParse({}))).toContain(
      "هیچ تغییری ارسال نشده است.",
    );
  });

  it("drops status, because archiving and settling have their own paths", () => {
    // A loan must not be markable as settled while instalments are owed.
    expect(updateLoanSchema.parse({ name: "x", status: "SETTLED" } as never)).toEqual({
      name: "x",
    });
  });

  it("applies the same rules as create to the fields it shares", () => {
    expect(updateLoanSchema.safeParse({ paymentDay: 40 }).success).toBe(false);
    expect(updateLoanSchema.safeParse({ installmentAmount: "0" }).success).toBe(false);
    expect(updateLoanSchema.safeParse({ installmentCount: 0 }).success).toBe(false);
  });
});

describe("payInstallmentSchema", () => {
  it("needs nothing: the loan's own account and today are the defaults", () => {
    const parsed = payInstallmentSchema.parse({});

    expect(parsed.accountId).toBeUndefined();
    expect(parsed.paidAt).toBeUndefined();
    expect(parsed.note).toBeNull();
  });

  it("takes an account and a date when they are given", () => {
    const parsed = payInstallmentSchema.parse({
      accountId: "acc_1",
      paidAt: "2026-06-21T00:00:00.000Z",
    });

    expect(parsed.accountId).toBe("acc_1");
    expect(parsed.paidAt?.toISOString()).toBe("2026-06-21T00:00:00.000Z");
  });

  it("rejects an unreadable payment date", () => {
    expect(payInstallmentSchema.safeParse({ paidAt: "زودتر" }).success).toBe(false);
  });
});

describe("loanFiltersSchema", () => {
  it("hides archived loans unless asked", () => {
    expect(loanFiltersSchema.parse({}).includeArchived).toBe(false);
    expect(loanFiltersSchema.parse({ includeArchived: "true" }).includeArchived).toBe(
      true,
    );
  });

  it('reads "false" as false, which Boolean("false") would not', () => {
    expect(loanFiltersSchema.parse({ includeArchived: "false" }).includeArchived).toBe(
      false,
    );
  });

  it("rejects a status it does not know or an empty owner", () => {
    expect(loanFiltersSchema.safeParse({ status: "PAID" }).success).toBe(false);
    expect(loanFiltersSchema.safeParse({ owner: "" }).success).toBe(false);
  });
});
