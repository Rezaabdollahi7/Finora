import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AppRuleError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { fromJalaliDate, toJalaliDate } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import {
  archiveAccount,
  createAccount,
} from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import {
  archiveLoan,
  createLoan,
  getLoan,
  listLoans,
  payInstallment,
  restoreLoan,
  unpayInstallment,
  updateLoan,
} from "@/features/loans/server/loan-service";
import {
  createLoanSchema,
  loanFiltersSchema,
  payInstallmentSchema,
  updateLoanSchema,
} from "@/features/loans/schemas";
import {
  deleteTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction-service";
import { updateTransactionSchema } from "@/features/transactions/schemas";

/**
 * Tasks 4.2 and 4.4, against a real PostgreSQL database.
 *
 * Several of the rules under test are enforced by constraints as well as by
 * the service — a mock would accept rows the database rejects.
 */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const parts = (iso: string) => {
  const { year, month, day } = toJalaliDate(new Date(iso));
  return `${year}/${month}/${day}`;
};

const NOW = jalali(1405, 9, 10);
const defaults = loanFiltersSchema.parse({});

let bank: Awaited<ReturnType<typeof createAccount>>;
let category: Awaited<ReturnType<typeof createCategory>>;

async function clear() {
  await prisma.installment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
}

beforeEach(async () => {
  await clear();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "500,000,000",
    }),
  );

  category = await createCategory(
    createCategorySchema.parse({ name: "قسط وام", kind: "EXPENSE" }),
  );
});

afterAll(async () => {
  await clear();
  await prisma.$disconnect();
});

/** Six monthly instalments of 4,100,000 Toman, due on the 5th. */
async function makeLoan(overrides: Record<string, unknown> = {}) {
  return createLoan(
    createLoanSchema.parse({
      name: "وام مسکن",
      provider: "بانک مسکن",
      principalAmount: "200,000,000",
      interestRate: "23",
      installmentAmount: "4,100,000",
      installmentCount: 6,
      startDate: jalali(1405, 6, 2),
      paymentDay: 5,
      owner: "REZA",
      accountId: bank.id,
      categoryId: category.id,
      ...overrides,
    }),
    NOW,
  );
}

describe("createLoan (4.2, 4.3)", () => {
  it("stores the money as Rial and the rate as basis points", async () => {
    const loan = await makeLoan();

    expect(loan.principalAmount).toBe("2000000000");
    expect(loan.installmentAmount).toBe("41000000");
    expect(loan.interestRate).toBe(2300);
  });

  it("generates the whole schedule at once", async () => {
    const loan = await makeLoan();

    expect(loan.installments).toHaveLength(6);
    expect(loan.installments.map((entry) => parts(entry.dueDate))).toEqual([
      "1405/6/5",
      "1405/7/5",
      "1405/8/5",
      "1405/9/5",
      "1405/10/5",
      "1405/11/5",
    ]);
  });

  it("sets the end date from the last instalment", async () => {
    expect(parts((await makeLoan()).endDate)).toBe("1405/11/5");
  });

  it("starts ACTIVE with nothing paid", async () => {
    const loan = await makeLoan();

    expect(loan.status).toBe("ACTIVE");
    expect(loan.progress).toMatchObject({ total: 6, paid: 0, remaining: 6 });
  });

  it("accepts a fractional interest rate", async () => {
    expect((await makeLoan({ interestRate: "23.5" })).interestRate).toBe(2350);
  });

  it("defaults the rate to zero, for an interest-free family loan", async () => {
    const loan = await createLoan(
      createLoanSchema.parse({
        name: "قرض خانوادگی",
        provider: "پدر",
        principalAmount: "50,000,000",
        installmentAmount: "5,000,000",
        installmentCount: 10,
        startDate: jalali(1405, 6, 2),
        paymentDay: 1,
        owner: "SHARED",
      }),
      NOW,
    );

    expect(loan.interestRate).toBe(0);
  });
});

describe("payInstallment (4.4)", () => {
  it("records an expense and marks the instalment paid", async () => {
    const loan = await makeLoan();
    const paid = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);

    const first = paid.installments[0]!;
    expect(first.status).toBe("PAID");
    expect(first.paidAt).not.toBeNull();
    expect(first.paidTransactionId).not.toBeNull();

    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: first.paidTransactionId! },
    });

    expect(transaction.type).toBe("EXPENSE");
    expect(transaction.amount).toBe(41_000_000n);
    expect(transaction.accountId).toBe(bank.id);
    expect(transaction.categoryId).toBe(category.id);
    expect(transaction.owner).toBe("REZA");
  });

  it("is an expense, never a transfer (rule G.3)", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);

    const transfers = await prisma.transaction.count({ where: { type: "TRANSFER" } });
    expect(transfers).toBe(0);
  });

  it("moves the progress figures", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    const after = await payInstallment(loan.id, 2, payInstallmentSchema.parse({}), NOW);

    expect(after.progress).toMatchObject({
      paid: 2,
      remaining: 4,
      paidAmount: "82000000",
      remainingAmount: "164000000",
    });
  });

  it("refuses a second payment of the same instalment", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);

    await expect(
      payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW),
    ).rejects.toMatchObject({ code: "ALREADY_PAID" });
  });

  it("creates exactly one expense even when the second attempt is refused", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW).catch(
      () => null,
    );

    expect(await prisma.transaction.count()).toBe(1);
  });

  it("cannot be paid twice even by two requests racing each other", async () => {
    const loan = await makeLoan();

    const results = await Promise.allSettled([
      payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW),
      payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("takes the payment date it was given", async () => {
    const loan = await makeLoan();
    const on = jalali(1405, 6, 7);

    const paid = await payInstallment(
      loan.id,
      1,
      payInstallmentSchema.parse({ paidAt: on }),
      NOW,
    );

    expect(paid.installments[0]!.paidAt).toBe(on.toISOString());

    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: paid.installments[0]!.paidTransactionId! },
    });
    expect(transaction.date.toISOString()).toBe(on.toISOString());
  });

  it("pays from another account when asked", async () => {
    const wallet = await createAccount(
      createAccountSchema.parse({
        name: "کیف پول",
        type: "WALLET",
        owner: "REZA",
        initialBalance: "100,000,000",
      }),
    );

    const loan = await makeLoan();
    const paid = await payInstallment(
      loan.id,
      1,
      payInstallmentSchema.parse({ accountId: wallet.id }),
      NOW,
    );

    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: paid.installments[0]!.paidTransactionId! },
    });
    expect(transaction.accountId).toBe(wallet.id);
  });

  it("refuses when there is no account to pay from", async () => {
    const loan = await makeLoan({ accountId: null });

    await expect(
      payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW),
    ).rejects.toMatchObject({ code: "NO_PAYMENT_ACCOUNT" });
  });

  it("refuses to pay from an archived account", async () => {
    const loan = await makeLoan();
    await archiveAccount(bank.id);

    await expect(
      payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
  });

  it("refuses to pay an instalment of an archived loan", async () => {
    const loan = await makeLoan();
    await archiveLoan(loan.id);

    await expect(
      payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW),
    ).rejects.toMatchObject({ code: "LOAN_ARCHIVED" });
  });

  it("reports a missing instalment rather than creating one", async () => {
    const loan = await makeLoan();

    await expect(
      payInstallment(loan.id, 99, payInstallmentSchema.parse({}), NOW),
    ).rejects.toBeInstanceOf(AppRuleError);
  });

  it("settles the loan when the last instalment is paid", async () => {
    const loan = await makeLoan();

    for (let number = 1; number <= 6; number += 1) {
      await payInstallment(loan.id, number, payInstallmentSchema.parse({}), NOW);
    }

    const settled = await getLoan(loan.id, NOW);

    expect(settled?.status).toBe("SETTLED");
    expect(settled?.progress.isSettled).toBe(true);
    expect(settled?.progress.remainingAmount).toBe("0");
  });

  it("keeps the stored status in step with the instalments", async () => {
    const loan = await makeLoan();

    for (let number = 1; number <= 6; number += 1) {
      const after = await payInstallment(
        loan.id,
        number,
        payInstallmentSchema.parse({}),
        NOW,
      );

      // The one denormalisation in the schema; this is the invariant that
      // justifies it.
      expect(after.status === "SETTLED").toBe(after.progress.isSettled);
    }
  });
});

describe("unpayInstallment (4.4)", () => {
  it("removes the expense and clears the instalment", async () => {
    const loan = await makeLoan();
    const paid = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    const transactionId = paid.installments[0]!.paidTransactionId!;

    const undone = await unpayInstallment(loan.id, 1, NOW);

    expect(undone.installments[0]!.status).not.toBe("PAID");
    expect(undone.installments[0]!.paidAt).toBeNull();
    expect(undone.progress.paid).toBe(0);
    expect(
      await prisma.transaction.findUnique({ where: { id: transactionId } }),
    ).toBeNull();
  });

  it("brings a settled loan back to active", async () => {
    const loan = await makeLoan();

    for (let number = 1; number <= 6; number += 1) {
      await payInstallment(loan.id, number, payInstallmentSchema.parse({}), NOW);
    }
    expect((await getLoan(loan.id, NOW))?.status).toBe("SETTLED");

    const undone = await unpayInstallment(loan.id, 3, NOW);
    expect(undone.status).toBe("ACTIVE");
  });

  it("lets the instalment be paid again afterwards", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    await unpayInstallment(loan.id, 1, NOW);

    const again = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    expect(again.installments[0]!.status).toBe("PAID");
    expect(await prisma.transaction.count()).toBe(1);
  });

  it("refuses to undo what was never paid", async () => {
    const loan = await makeLoan();

    await expect(unpayInstallment(loan.id, 1, NOW)).rejects.toMatchObject({
      code: "NOT_PAID",
    });
  });
});

describe("a loan payment is not an ordinary transaction", () => {
  it("cannot be deleted from the transactions side", async () => {
    const loan = await makeLoan();
    const paid = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    const transactionId = paid.installments[0]!.paidTransactionId!;

    // Deleting it would leave the schedule claiming a payment that no longer
    // exists. The message points at the way back.
    await expect(deleteTransaction(transactionId)).rejects.toMatchObject({
      code: "LOAN_INSTALLMENT_PAYMENT",
    });

    expect(
      await prisma.transaction.findUnique({ where: { id: transactionId } }),
    ).not.toBeNull();
  });

  it("cannot be edited from the transactions side", async () => {
    const loan = await makeLoan();
    const paid = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    const transactionId = paid.installments[0]!.paidTransactionId!;

    await expect(
      updateTransaction(
        transactionId,
        updateTransactionSchema.parse({
          type: "EXPENSE",
          amount: "1,000",
          accountId: bank.id,
          owner: "REZA",
          date: NOW,
        }),
      ),
    ).rejects.toMatchObject({ code: "LOAN_INSTALLMENT_PAYMENT" });
  });

  it("can be deleted once the payment is undone", async () => {
    const loan = await makeLoan();
    const paid = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    const transactionId = paid.installments[0]!.paidTransactionId!;

    await unpayInstallment(loan.id, 1, NOW);

    expect(
      await prisma.transaction.findUnique({ where: { id: transactionId } }),
    ).toBeNull();
  });
});

describe("updateLoan (4.2)", () => {
  it("edits the descriptive fields without touching the schedule", async () => {
    const loan = await makeLoan();
    const before = loan.installments.map((entry) => entry.dueDate);

    const updated = await updateLoan(
      loan.id,
      updateLoanSchema.parse({ name: "وام خرید خانه", provider: "بانک صادرات" }),
      NOW,
    );

    expect(updated.name).toBe("وام خرید خانه");
    expect(updated.installments.map((entry) => entry.dueDate)).toEqual(before);
  });

  it("regenerates the unpaid instalments when the payment day moves", async () => {
    const loan = await makeLoan();

    const updated = await updateLoan(
      loan.id,
      updateLoanSchema.parse({ paymentDay: 20 }),
      NOW,
    );

    expect(updated.installments.map((entry) => parts(entry.dueDate))).toEqual([
      "1405/6/20",
      "1405/7/20",
      "1405/8/20",
      "1405/9/20",
      "1405/10/20",
      "1405/11/20",
    ]);
  });

  it("leaves a paid instalment exactly as it was paid (rule G.4)", async () => {
    const loan = await makeLoan();
    const paid = await payInstallment(loan.id, 1, payInstallmentSchema.parse({}), NOW);
    const before = paid.installments[0]!;

    const updated = await updateLoan(
      loan.id,
      updateLoanSchema.parse({ paymentDay: 20, installmentAmount: "9,000,000" }),
      NOW,
    );

    const after = updated.installments[0]!;

    // Same due date, same amount, same transaction: renegotiating the loan
    // did not change what was already handed over.
    expect(after.id).toBe(before.id);
    expect(after.dueDate).toBe(before.dueDate);
    expect(after.amount).toBe(before.amount);
    expect(after.paidTransactionId).toBe(before.paidTransactionId);

    // The instalments still owed took the new amount and the new day.
    expect(updated.installments[1]!.amount).toBe("90000000");
    expect(parts(updated.installments[1]!.dueDate)).toBe("1405/7/20");
  });

  it("extends a loan by adding instalments at the end", async () => {
    const loan = await makeLoan();

    const updated = await updateLoan(
      loan.id,
      updateLoanSchema.parse({ installmentCount: 9 }),
      NOW,
    );

    expect(updated.installments).toHaveLength(9);
    expect(parts(updated.installments[8]!.dueDate)).toBe("1406/2/5");
    expect(parts(updated.endDate)).toBe("1406/2/5");
  });

  it("shortens a loan by dropping unpaid instalments from the end", async () => {
    const loan = await makeLoan();

    const updated = await updateLoan(
      loan.id,
      updateLoanSchema.parse({ installmentCount: 3 }),
      NOW,
    );

    expect(updated.installments).toHaveLength(3);
    expect(parts(updated.endDate)).toBe("1405/8/5");
  });

  it("refuses to shorten a loan past an instalment that was paid", async () => {
    const loan = await makeLoan();
    await payInstallment(loan.id, 5, payInstallmentSchema.parse({}), NOW);

    // Dropping instalment 5 would orphan a real expense.
    await expect(
      updateLoan(loan.id, updateLoanSchema.parse({ installmentCount: 3 }), NOW),
    ).rejects.toMatchObject({ code: "PAID_BEYOND_NEW_COUNT" });
  });

  it("refuses to edit an archived loan", async () => {
    const loan = await makeLoan();
    await archiveLoan(loan.id);

    await expect(
      updateLoan(loan.id, updateLoanSchema.parse({ name: "x" }), NOW),
    ).rejects.toMatchObject({ code: "LOAN_ARCHIVED" });
  });
});

describe("archiveLoan / restoreLoan (4.2)", () => {
  it("hides an archived loan from the default list but keeps its schedule", async () => {
    const loan = await makeLoan();
    await archiveLoan(loan.id);

    expect(await listLoans(defaults, NOW)).toHaveLength(0);
    expect(
      await listLoans(loanFiltersSchema.parse({ includeArchived: true }), NOW),
    ).toHaveLength(1);
    expect((await getLoan(loan.id, NOW))?.installments).toHaveLength(6);
  });

  it("refuses to archive twice, and to restore what is not archived", async () => {
    const loan = await makeLoan();
    await archiveLoan(loan.id);

    await expect(archiveLoan(loan.id)).rejects.toMatchObject({
      code: "ALREADY_ARCHIVED",
    });

    await restoreLoan(loan.id, NOW);
    await expect(restoreLoan(loan.id, NOW)).rejects.toMatchObject({
      code: "ALREADY_ACTIVE",
    });
  });

  it("restores to whatever is actually owed, not to what it was before", async () => {
    const loan = await makeLoan();

    for (let number = 1; number <= 6; number += 1) {
      await payInstallment(loan.id, number, payInstallmentSchema.parse({}), NOW);
    }

    await archiveLoan(loan.id);
    const restored = await restoreLoan(loan.id, NOW);

    expect(restored.status).toBe("SETTLED");
  });
});

describe("listLoans", () => {
  it("filters by owner and by status", async () => {
    await makeLoan();
    await makeLoan({ name: "وام خودرو", owner: "YEGANEH" });

    expect(
      await listLoans(loanFiltersSchema.parse({ owner: "REZA" }), NOW),
    ).toHaveLength(1);
    expect(
      await listLoans(loanFiltersSchema.parse({ status: "SETTLED" }), NOW),
    ).toHaveLength(0);
  });

  it("carries each loan's progress without a query per loan", async () => {
    const first = await makeLoan();
    await makeLoan({ name: "وام خودرو" });
    await payInstallment(first.id, 1, payInstallmentSchema.parse({}), NOW);

    const loans = await listLoans(defaults, NOW);
    const byName = new Map(loans.map((loan) => [loan.name, loan]));

    expect(byName.get("وام مسکن")?.progress.paid).toBe(1);
    expect(byName.get("وام خودرو")?.progress.paid).toBe(0);
  });
});
