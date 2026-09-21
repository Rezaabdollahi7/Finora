import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount, getAccount } from "@/features/accounts/server/account-service";
import type { AccountType } from "@/features/accounts/types";
import { createTransactionSchema } from "@/features/transactions/schemas";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction-service";

/**
 * Task 1.5 against a real database: the balance rules, the ban on transfers
 * counting as income or expense, the negative-balance guard, and the
 * positive-amount requirement.
 */

const DATE = "2026-09-21T09:00:00.000Z";

async function account(name: string, type: AccountType, opening: string) {
  return createAccount(
    createAccountSchema.parse({ name, type, owner: "SHARED", initialBalance: opening }),
  );
}

async function record(input: Record<string, unknown>) {
  return createTransaction(
    createTransactionSchema.parse({ owner: "SHARED", date: DATE, ...input }),
  );
}

const balanceOf = async (id: string) => BigInt((await getAccount(id))!.balance);

beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
});

afterAll(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.$disconnect();
});

describe("income and expense", () => {
  it("income increases the account balance", async () => {
    const acc = await account("بانک", "BANK", "1,000,000");
    await record({ type: "INCOME", amount: "500,000", accountId: acc.id });

    expect(await balanceOf(acc.id)).toBe(15_000_000n);
  });

  it("expense decreases the account balance", async () => {
    const acc = await account("بانک", "BANK", "1,000,000");
    await record({ type: "EXPENSE", amount: "250,000", accountId: acc.id });

    expect(await balanceOf(acc.id)).toBe(7_500_000n);
  });

  it("keeps the count of transactions touching the account", async () => {
    const acc = await account("بانک", "BANK", "0");
    await record({ type: "INCOME", amount: "100", accountId: acc.id });
    await record({ type: "EXPENSE", amount: "50", accountId: acc.id });

    expect((await getAccount(acc.id))!.transactionCount).toBe(2);
  });
});

describe("transfers", () => {
  it("decreases the source and increases the destination", async () => {
    const from = await account("بانک", "BANK", "1,000,000");
    const to = await account("کیف پول", "WALLET", "0");

    await record({
      type: "TRANSFER",
      amount: "300,000",
      accountId: from.id,
      toAccountId: to.id,
    });

    expect(await balanceOf(from.id)).toBe(7_000_000n);
    expect(await balanceOf(to.id)).toBe(3_000_000n);
  });

  it("does not change the household total (rule G.3)", async () => {
    const from = await account("بانک", "BANK", "1,000,000");
    const to = await account("کیف پول", "WALLET", "200,000");
    const before = (await balanceOf(from.id)) + (await balanceOf(to.id));

    await record({
      type: "TRANSFER",
      amount: "450,000",
      accountId: from.id,
      toAccountId: to.id,
    });

    expect((await balanceOf(from.id)) + (await balanceOf(to.id))).toBe(before);
  });

  it("is counted as neither income nor expense (rule G.3)", async () => {
    const from = await account("بانک", "BANK", "1,000,000");
    const to = await account("کیف پول", "WALLET", "0");
    await record({
      type: "TRANSFER",
      amount: "100,000",
      accountId: from.id,
      toAccountId: to.id,
    });

    const income = await prisma.transaction.aggregate({
      where: { type: "INCOME" },
      _sum: { amount: true },
    });
    const expense = await prisma.transaction.aggregate({
      where: { type: "EXPENSE" },
      _sum: { amount: true },
    });

    expect(income._sum.amount).toBeNull();
    expect(expense._sum.amount).toBeNull();
  });

  it("appears in the transaction count of both accounts", async () => {
    const from = await account("بانک", "BANK", "1,000,000");
    const to = await account("کیف پول", "WALLET", "0");
    await record({
      type: "TRANSFER",
      amount: "100,000",
      accountId: from.id,
      toAccountId: to.id,
    });

    expect((await getAccount(from.id))!.transactionCount).toBe(1);
    expect((await getAccount(to.id))!.transactionCount).toBe(1);
  });

  it("rejects a transfer with no destination, or to itself", async () => {
    const acc = await account("بانک", "BANK", "1,000,000");

    expect(() =>
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: "1000",
        accountId: acc.id,
        owner: "SHARED",
        date: DATE,
      }),
    ).toThrow();

    expect(() =>
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: "1000",
        accountId: acc.id,
        toAccountId: acc.id,
        owner: "SHARED",
        date: DATE,
      }),
    ).toThrow();
  });

  it("rejects a destination on something that is not a transfer", () => {
    expect(() =>
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "1000",
        accountId: "a",
        toAccountId: "b",
        owner: "SHARED",
        date: DATE,
      }),
    ).toThrow();
  });

  it("rejects a categorised transfer, which would double-count spending", () => {
    expect(() =>
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: "1000",
        accountId: "a",
        toAccountId: "b",
        categoryId: "food",
        owner: "SHARED",
        date: DATE,
      }),
    ).toThrow();
  });
});

describe("amounts are positive", () => {
  it("rejects zero and negative amounts", () => {
    for (const amount of ["0", "-1", "-125,000"]) {
      expect(
        () =>
          createTransactionSchema.parse({
            type: "EXPENSE",
            amount,
            accountId: "a",
            owner: "SHARED",
            date: DATE,
          }),
        amount,
      ).toThrow();
    }
  });

  it("rejects an unreadable amount rather than treating it as zero", () => {
    expect(() =>
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "abc",
        accountId: "a",
        owner: "SHARED",
        date: DATE,
      }),
    ).toThrow();
  });

  it("is enforced by the database too, not only by validation", async () => {
    const acc = await account("بانک", "BANK", "1,000,000");

    await expect(
      prisma.transaction.create({
        data: {
          type: "EXPENSE",
          amount: -1n,
          accountId: acc.id,
          owner: "SHARED",
          date: new Date(DATE),
        },
      }),
    ).rejects.toThrow();
  });
});

describe("negative balance guard", () => {
  it("refuses to overdraw cash", async () => {
    const cash = await account("نقد", "CASH", "100,000");

    await expect(
      record({ type: "EXPENSE", amount: "150,000", accountId: cash.id }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE", status: 409 });

    expect(await balanceOf(cash.id)).toBe(1_000_000n);
  });

  it("allows spending down to exactly zero", async () => {
    const cash = await account("نقد", "CASH", "100,000");
    await record({ type: "EXPENSE", amount: "100,000", accountId: cash.id });

    expect(await balanceOf(cash.id)).toBe(0n);
  });

  it("allows a bank account to go negative", async () => {
    const bank = await account("بانک", "BANK", "100,000");
    await record({ type: "EXPENSE", amount: "150,000", accountId: bank.id });

    expect(await balanceOf(bank.id)).toBe(-500_000n);
  });

  it("refuses a transfer that would overdraw the source wallet", async () => {
    const wallet = await account("کیف پول", "WALLET", "50,000");
    const bank = await account("بانک", "BANK", "0");

    await expect(
      record({
        type: "TRANSFER",
        amount: "80,000",
        accountId: wallet.id,
        toAccountId: bank.id,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
  });

  it("checks the resulting total, so order of entry does not matter", async () => {
    const cash = await account("نقد", "CASH", "0");

    // Recording the income first makes the later expense affordable, and the
    // rule is about the account's total rather than a running balance at a
    // date, so a back-dated expense is judged the same way.
    await record({ type: "INCOME", amount: "200,000", accountId: cash.id });
    await record({
      type: "EXPENSE",
      amount: "150,000",
      accountId: cash.id,
      date: "2026-01-01T09:00:00.000Z",
    });

    expect(await balanceOf(cash.id)).toBe(500_000n);
  });

  it("refuses an edit that would overdraw, and leaves the original intact", async () => {
    const cash = await account("نقد", "CASH", "100,000");
    const spend = await record({
      type: "EXPENSE",
      amount: "50,000",
      accountId: cash.id,
    });

    await expect(
      updateTransaction(
        spend.id,
        createTransactionSchema.parse({
          type: "EXPENSE",
          amount: "500,000",
          accountId: cash.id,
          owner: "SHARED",
          date: DATE,
        }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });

    expect(await balanceOf(cash.id)).toBe(500_000n);
  });

  it("scores an edit as undo-then-apply, not as a second write", async () => {
    const cash = await account("نقد", "CASH", "100,000");
    const spend = await record({
      type: "EXPENSE",
      amount: "90,000",
      accountId: cash.id,
    });

    // 100,000 in the account with 90,000 already spent. Raising the expense
    // to 100,000 only works if the original 90,000 is undone first.
    await updateTransaction(
      spend.id,
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "100,000",
        accountId: cash.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(await balanceOf(cash.id)).toBe(0n);
  });

  it("refuses a delete that would overdraw", async () => {
    const cash = await account("نقد", "CASH", "0");
    const income = await record({
      type: "INCOME",
      amount: "100,000",
      accountId: cash.id,
    });
    await record({ type: "EXPENSE", amount: "80,000", accountId: cash.id });

    await expect(deleteTransaction(income.id)).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });

    expect(await balanceOf(cash.id)).toBe(200_000n);
  });
});

describe("archived accounts", () => {
  it("cannot receive a new transaction", async () => {
    const acc = await account("بانک", "BANK", "1,000,000");
    await prisma.account.update({ where: { id: acc.id }, data: { isActive: false } });

    await expect(
      record({ type: "EXPENSE", amount: "1,000", accountId: acc.id }),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
  });

  it("cannot be the destination of a transfer", async () => {
    const from = await account("بانک", "BANK", "1,000,000");
    const to = await account("کیف پول", "WALLET", "0");
    await prisma.account.update({ where: { id: to.id }, data: { isActive: false } });

    await expect(
      record({
        type: "TRANSFER",
        amount: "1,000",
        accountId: from.id,
        toAccountId: to.id,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_ARCHIVED" });
  });
});

describe("unknown accounts", () => {
  it("reports a missing account as 404", async () => {
    await expect(
      record({ type: "EXPENSE", amount: "1,000", accountId: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
