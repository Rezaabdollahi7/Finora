import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import { fromJalaliDate, toJalaliDate } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import {
  archiveAccount,
  createAccount,
} from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import {
  createRecurringPaymentSchema,
  payOccurrenceSchema,
  recurringFiltersSchema,
  updateRecurringPaymentSchema,
} from "@/features/recurring/schemas";
import {
  createRecurringPayment,
  listRecurringPayments,
  occurrencesForWindow,
  payOccurrence,
  setRecurringPaymentActive,
  unpayOccurrence,
  updateRecurringPayment,
} from "@/features/recurring/server/recurring-service";
import {
  deleteTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction-service";
import { updateTransactionSchema } from "@/features/transactions/schemas";

/** Tasks 5.3–5.5, against a real PostgreSQL database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const day = (iso: string) => {
  const { year, month, day: d } = toJalaliDate(new Date(iso));
  return `${year}/${month}/${d}`;
};

const NOW = jalali(1405, 6, 20);
const defaults = recurringFiltersSchema.parse({});

let bank: Awaited<ReturnType<typeof createAccount>>;
let category: Awaited<ReturnType<typeof createCategory>>;

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

  category = await createCategory(
    createCategorySchema.parse({ name: "اجاره", kind: "EXPENSE" }),
  );
});

afterAll(async () => {
  await resetLedger();
  await prisma.$disconnect();
});

/** Rent of 5,000,000 Toman on the first of every Jalali month. */
async function makeRent(overrides: Record<string, unknown> = {}) {
  return createRecurringPayment(
    createRecurringPaymentSchema.parse({
      name: "اجاره",
      amount: "5,000,000",
      frequency: "MONTHLY",
      interval: 1,
      startDate: jalali(1405, 4, 1),
      paymentDay: 1,
      owner: "SHARED",
      accountId: bank.id,
      categoryId: category.id,
      ...overrides,
    }),
    NOW,
  );
}

describe("createRecurringPayment (5.1)", () => {
  it("stores the amount as Rial and keeps the rule's shape", async () => {
    const rent = await makeRent();

    expect(rent.amount).toBe("50000000");
    expect(rent.frequency).toBe("MONTHLY");
    expect(rent.paymentDay).toBe(1);
    expect(rent.isActive).toBe(true);
  });

  it("writes no occurrence rows: a future payment is not an expense (5.3)", async () => {
    await makeRent();

    expect(await prisma.recurringOccurrence.count()).toBe(0);
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("projects the occurrences anyway", async () => {
    const rent = await makeRent();

    // Tir through Shahrivar are behind the 20th of Shahrivar; the rest are
    // ahead of it. All of them are derived, none stored.
    expect(rent.occurrences.map((entry) => day(entry.dueDate))).toContain("1405/6/1");
    expect(rent.occurrences.every((entry) => entry.id === null)).toBe(true);
  });

  it("drops a payment day the frequency does not use", async () => {
    const weekly = await makeRent({ frequency: "WEEKLY", paymentDay: 12 });

    // A weekly rule takes its day from the start date; storing a payment day
    // would be a field nothing reads.
    expect(weekly.paymentDay).toBeNull();
  });
});

describe("the next date still owed (5.5)", () => {
  it("is the soonest unpaid occurrence, not the soonest future one", async () => {
    const rent = await makeRent();

    // The rule started in Tir and nothing has been paid, so Tir is still
    // owed even though Shahrivar is the current month.
    expect(day(rent.nextDueDate!)).toBe("1405/4/1");
    expect(rent.nextStatus).toBe("OVERDUE");
  });

  it("moves on as occurrences are paid", async () => {
    const rent = await makeRent();

    await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 4, 1) }),
      NOW,
    );
    const after = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 5, 1) }),
      NOW,
    );

    expect(day(after.nextDueDate!)).toBe("1405/6/1");
  });

  it("is null for an inactive rule", async () => {
    const rent = await makeRent();
    const off = await setRecurringPaymentActive(rent.id, false, NOW);

    expect(off.nextDueDate).toBeNull();
  });

  it("is null once the rule has ended", async () => {
    const rent = await makeRent({ endDate: jalali(1405, 5, 1) });

    await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 4, 1) }),
      NOW,
    );
    const after = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 5, 1) }),
      NOW,
    );

    expect(after.nextDueDate).toBeNull();
  });
});

describe("payOccurrence (5.4)", () => {
  it("turns an expected occurrence into a real expense", async () => {
    const rent = await makeRent();

    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) }),
      NOW,
    );

    const occurrence = paid.occurrences.find(
      (entry) => day(entry.dueDate) === "1405/6/1",
    )!;

    expect(occurrence.status).toBe("PAID");
    expect(occurrence.id).not.toBeNull();

    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: occurrence.paidTransactionId! },
    });

    expect(transaction.type).toBe("EXPENSE");
    expect(transaction.amount).toBe(50_000_000n);
    expect(transaction.accountId).toBe(bank.id);
    expect(transaction.categoryId).toBe(category.id);
  });

  it("dates the expense the day it was due, not the day it was recorded", async () => {
    // Recording Tir's rent in Shahrivar must not move the expense into
    // Shahrivar's report.
    const rent = await makeRent();

    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 4, 1) }),
      NOW,
    );

    const occurrence = paid.occurrences.find(
      (entry) => day(entry.dueDate) === "1405/4/1",
    )!;
    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: occurrence.paidTransactionId! },
    });

    expect(day(transaction.date.toISOString())).toBe("1405/4/1");
  });

  it("takes a payment date when one is given", async () => {
    const rent = await makeRent();

    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({
        dueDate: jalali(1405, 6, 1),
        paidAt: jalali(1405, 6, 4),
      }),
      NOW,
    );

    const occurrence = paid.occurrences.find(
      (entry) => day(entry.dueDate) === "1405/6/1",
    )!;

    expect(day(occurrence.paidAt!)).toBe("1405/6/4");
  });

  it("records what was actually paid when it differs from the rule", async () => {
    // A utility bill is "about" a figure; the month it is not is the month
    // worth recording faithfully.
    const rent = await makeRent();

    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({
        dueDate: jalali(1405, 6, 1),
        amount: "5,400,000",
      }),
      NOW,
    );

    const occurrence = paid.occurrences.find(
      (entry) => day(entry.dueDate) === "1405/6/1",
    )!;

    expect(occurrence.amount).toBe("54000000");
    // The rule itself is unchanged: one unusual month is not a new rent.
    expect(paid.amount).toBe("50000000");
  });

  it("refuses to pay the same occurrence twice", async () => {
    const rent = await makeRent();
    const input = payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) });

    await payOccurrence(rent.id, input, NOW);

    await expect(payOccurrence(rent.id, input, NOW)).rejects.toMatchObject({
      code: "ALREADY_PAID",
    });
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("cannot be paid twice by two requests racing each other", async () => {
    const rent = await makeRent();
    const input = payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) });

    const results = await Promise.allSettled([
      payOccurrence(rent.id, input, NOW),
      payOccurrence(rent.id, input, NOW),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("refuses a date the rule never produces", async () => {
    // Rent falls on the first; the fifteenth is not an occurrence of it.
    const rent = await makeRent();

    await expect(
      payOccurrence(
        rent.id,
        payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 15) }),
        NOW,
      ),
    ).rejects.toMatchObject({ code: "NOT_AN_OCCURRENCE" });
  });

  it("refuses to pay an inactive rule", async () => {
    const rent = await makeRent();
    await setRecurringPaymentActive(rent.id, false, NOW);

    await expect(
      payOccurrence(
        rent.id,
        payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) }),
        NOW,
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_INACTIVE" });
  });

  it("refuses when there is no account to pay from", async () => {
    const rent = await makeRent({ accountId: null });

    await expect(
      payOccurrence(
        rent.id,
        payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) }),
        NOW,
      ),
    ).rejects.toMatchObject({ code: "NO_PAYMENT_ACCOUNT" });
  });

  it("refuses to pay from an archived account", async () => {
    const rent = await makeRent();
    await archiveAccount(bank.id);

    await expect(
      payOccurrence(
        rent.id,
        payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) }),
        NOW,
      ),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
  });
});

describe("unpayOccurrence (5.4)", () => {
  it("removes the expense and the occurrence together", async () => {
    const rent = await makeRent();
    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) }),
      NOW,
    );

    const transactionId = paid.occurrences.find(
      (entry) => day(entry.dueDate) === "1405/6/1",
    )!.paidTransactionId!;

    const undone = await unpayOccurrence(rent.id, jalali(1405, 6, 1), NOW);

    expect(undone.paidCount).toBe(0);
    expect(
      await prisma.transaction.findUnique({ where: { id: transactionId } }),
    ).toBeNull();
  });

  it("lets the occurrence be paid again", async () => {
    const rent = await makeRent();
    const input = payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) });

    await payOccurrence(rent.id, input, NOW);
    await unpayOccurrence(rent.id, jalali(1405, 6, 1), NOW);
    const again = await payOccurrence(rent.id, input, NOW);

    expect(again.paidCount).toBe(1);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("refuses to undo what was never paid", async () => {
    const rent = await makeRent();

    await expect(unpayOccurrence(rent.id, jalali(1405, 6, 1), NOW)).rejects.toThrow();
  });
});

describe("editing a rule (5.5, rule G.4)", () => {
  it("changes what is expected without touching what was paid", async () => {
    const rent = await makeRent();

    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 4, 1) }),
      NOW,
    );
    const before = paid.occurrences.find((e) => day(e.dueDate) === "1405/4/1")!;

    const updated = await updateRecurringPayment(
      rent.id,
      updateRecurringPaymentSchema.parse({ amount: "6,500,000" }),
      NOW,
    );

    const after = updated.occurrences.find((e) => day(e.dueDate) === "1405/4/1")!;

    // A rent that went up in Shahrivar did not retroactively cost more in Tir.
    expect(after.id).toBe(before.id);
    expect(after.amount).toBe("50000000");
    // What is still expected takes the new figure.
    expect(updated.occurrences.find((e) => day(e.dueDate) === "1405/7/1")!.amount).toBe(
      "65000000",
    );
  });

  it("keeps a paid occurrence visible even when the rule no longer produces it", async () => {
    const rent = await makeRent();
    await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 4, 1) }),
      NOW,
    );

    // Move the payment day: the first of Tir is no longer a date this rule
    // produces, but it is a real expense that happened.
    const updated = await updateRecurringPayment(
      rent.id,
      updateRecurringPaymentSchema.parse({ paymentDay: 15 }),
      NOW,
    );

    const kept = updated.occurrences.find((e) => day(e.dueDate) === "1405/4/1");

    expect(kept).toBeDefined();
    expect(kept!.status).toBe("PAID");
  });
});

describe("activating and deactivating (5.5)", () => {
  it("stops projecting expected occurrences but keeps the paid ones", async () => {
    const rent = await makeRent();
    await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 4, 1) }),
      NOW,
    );

    const off = await setRecurringPaymentActive(rent.id, false, NOW);

    expect(off.occurrences).toHaveLength(1);
    expect(off.occurrences[0]!.status).toBe("PAID");
    expect(off.paidTotal).toBe("50000000");
  });

  it("hides an inactive rule from the default list", async () => {
    const rent = await makeRent();
    await setRecurringPaymentActive(rent.id, false, NOW);

    expect(await listRecurringPayments(defaults, NOW)).toHaveLength(0);
    expect(
      await listRecurringPayments(
        recurringFiltersSchema.parse({ includeInactive: true }),
        NOW,
      ),
    ).toHaveLength(1);
  });

  it("refuses to switch a rule to the state it is already in", async () => {
    const rent = await makeRent();

    await expect(setRecurringPaymentActive(rent.id, true, NOW)).rejects.toMatchObject({
      code: "ALREADY_ACTIVE",
    });
  });
});

describe("a recurring payment's expense is not an ordinary transaction", () => {
  it("cannot be deleted or edited from the transactions side", async () => {
    const rent = await makeRent();
    const paid = await payOccurrence(
      rent.id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1) }),
      NOW,
    );

    const transactionId = paid.occurrences.find(
      (entry) => day(entry.dueDate) === "1405/6/1",
    )!.paidTransactionId!;

    await expect(deleteTransaction(transactionId)).rejects.toMatchObject({
      code: "RECURRING_PAYMENT",
    });

    await expect(
      updateTransaction(
        transactionId,
        updateTransactionSchema.parse({
          type: "EXPENSE",
          amount: "1,000",
          accountId: bank.id,
          owner: "SHARED",
          date: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "RECURRING_PAYMENT" });
  });
});

describe("occurrencesForWindow (4.7)", () => {
  it("returns every active rule's occurrences in the window, in date order", async () => {
    await makeRent();
    await makeRent({ name: "اینترنت", amount: "800,000", paymentDay: 10 });

    const window = { start: jalali(1405, 6, 1), end: jalali(1405, 7, 1) };
    const occurrences = await occurrencesForWindow(window, NOW);

    expect(occurrences.map((entry) => day(entry.dueDate))).toEqual([
      "1405/6/1",
      "1405/6/10",
    ]);
  });

  it("leaves an inactive rule out", async () => {
    const rent = await makeRent();
    await setRecurringPaymentActive(rent.id, false, NOW);

    expect(
      await occurrencesForWindow(
        { start: jalali(1405, 6, 1), end: jalali(1405, 7, 1) },
        NOW,
      ),
    ).toEqual([]);
  });

  it("does not project a rule before it starts or after it ends", async () => {
    await makeRent({ startDate: jalali(1405, 6, 1), endDate: jalali(1405, 7, 1) });

    const before = await occurrencesForWindow(
      { start: jalali(1405, 5, 1), end: jalali(1405, 6, 1) },
      NOW,
    );
    const after = await occurrencesForWindow(
      { start: jalali(1405, 8, 1), end: jalali(1405, 9, 1) },
      NOW,
    );

    expect(before).toEqual([]);
    expect(after).toEqual([]);
  });

  it("does not query per rule", async () => {
    for (let index = 0; index < 6; index += 1) {
      await makeRent({ name: `پرداخت ${index}`, paymentDay: index + 1 });
    }

    const occurrences = await occurrencesForWindow(
      { start: jalali(1405, 6, 1), end: jalali(1405, 7, 1) },
      NOW,
    );

    // Six rules, six dates, and the expected ones were computed rather than
    // fetched — there are no rows for them at all.
    expect(occurrences).toHaveLength(6);
    expect(await prisma.recurringOccurrence.count()).toBe(0);
  });
});
