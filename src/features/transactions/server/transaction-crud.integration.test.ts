import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import {
  createTransactionSchema,
  transactionFiltersSchema,
} from "@/features/transactions/schemas";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "@/features/transactions/server/transaction-service";

/** Task 1.6: create, edit, delete, details, filter, search, pagination. */

const DATE = "2026-09-21T09:00:00.000Z";

let bank: Awaited<ReturnType<typeof createAccount>>;
let wallet: Awaited<ReturnType<typeof createAccount>>;

async function record(input: Record<string, unknown>) {
  return createTransaction(
    createTransactionSchema.parse({
      type: "EXPENSE",
      amount: "10,000",
      accountId: bank.id,
      owner: "SHARED",
      date: DATE,
      ...input,
    }),
  );
}

const defaults = transactionFiltersSchema.parse({});

beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "10,000,000",
    }),
  );
  wallet = await createAccount(
    createAccountSchema.parse({
      name: "کیف پول رضا",
      type: "WALLET",
      owner: "REZA",
      initialBalance: "1,000,000",
    }),
  );
});

afterAll(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.$disconnect();
});

describe("create", () => {
  it("stores the amount as positive Rial and resolves the account name", async () => {
    const transaction = await record({ amount: "250,000", description: "خرید هفتگی" });

    expect(transaction).toMatchObject({
      type: "EXPENSE",
      amount: "2500000",
      accountId: bank.id,
      accountName: "بانک ملت",
      toAccountId: null,
      toAccountName: null,
      description: "خرید هفتگی",
      owner: "SHARED",
    });
  });

  it("resolves both account names for a transfer", async () => {
    const transaction = await record({
      type: "TRANSFER",
      amount: "100,000",
      accountId: bank.id,
      toAccountId: wallet.id,
    });

    expect(transaction.accountName).toBe("بانک ملت");
    expect(transaction.toAccountName).toBe("کیف پول رضا");
  });

  it("stores the date as the UTC instant it was given", async () => {
    const transaction = await record({ date: "2026-03-21T20:30:00.000Z" });
    expect(transaction.date).toBe("2026-03-21T20:30:00.000Z");
  });

  it("normalises an empty description to null", async () => {
    expect((await record({ description: "   " })).description).toBeNull();
  });
});

describe("details", () => {
  it("returns the transaction", async () => {
    const created = await record({});
    expect((await getTransaction(created.id))?.id).toBe(created.id);
  });

  it("returns null for an unknown id rather than throwing", async () => {
    expect(await getTransaction("nope")).toBeNull();
  });
});

describe("edit", () => {
  it("replaces every field", async () => {
    const created = await record({ description: "قبلی" });

    const updated = await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "INCOME",
        amount: "75,000",
        accountId: wallet.id,
        owner: "REZA",
        description: "بعدی",
        date: "2026-08-01T09:00:00.000Z",
      }),
    );

    expect(updated).toMatchObject({
      id: created.id,
      type: "INCOME",
      amount: "750000",
      accountId: wallet.id,
      owner: "REZA",
      description: "بعدی",
    });
    expect(updated.date).toBe("2026-08-01T09:00:00.000Z");
  });

  it("can turn an expense into a transfer", async () => {
    const created = await record({ amount: "50,000" });

    const updated = await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: "50,000",
        accountId: bank.id,
        toAccountId: wallet.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(updated.type).toBe("TRANSFER");
    expect(updated.toAccountId).toBe(wallet.id);
  });

  it("reports a missing transaction as 404", async () => {
    await expect(
      updateTransaction(
        "nope",
        createTransactionSchema.parse({
          type: "EXPENSE",
          amount: "1,000",
          accountId: bank.id,
          owner: "SHARED",
          date: DATE,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("delete", () => {
  it("removes the row", async () => {
    const created = await record({});
    await deleteTransaction(created.id);

    expect(await getTransaction(created.id)).toBeNull();
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("reports a missing transaction as 404", async () => {
    await expect(deleteTransaction("nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("filter", () => {
  beforeEach(async () => {
    await record({
      type: "INCOME",
      amount: "1,000",
      accountId: bank.id,
      owner: "SHARED",
    });
    await record({
      type: "EXPENSE",
      amount: "2,000",
      accountId: bank.id,
      owner: "REZA",
    });
    await record({
      type: "TRANSFER",
      amount: "3,000",
      accountId: bank.id,
      toAccountId: wallet.id,
      owner: "SHARED",
    });
  });

  it("filters by type", async () => {
    const page = await listTransactions(
      transactionFiltersSchema.parse({ type: "INCOME" }),
    );
    expect(page.total).toBe(1);
    expect(page.transactions[0]?.type).toBe("INCOME");
  });

  it("filters by owner", async () => {
    const page = await listTransactions(
      transactionFiltersSchema.parse({ owner: "REZA" }),
    );
    expect(page.total).toBe(1);
  });

  it("includes transfers in *and* out when filtering by account", async () => {
    // The wallet only ever received a transfer; it must still show up on the
    // wallet's list, or an account page would hide money arriving into it.
    const page = await listTransactions(
      transactionFiltersSchema.parse({ accountId: wallet.id }),
    );

    expect(page.total).toBe(1);
    expect(page.transactions[0]?.type).toBe("TRANSFER");
  });

  it("returns everything when unfiltered", async () => {
    expect((await listTransactions(defaults)).total).toBe(3);
  });
});

describe("search", () => {
  beforeEach(async () => {
    await record({ description: "خرید نان از نانوایی" });
    await record({ description: "قبض برق" });
    await record({ description: null });
  });

  it("matches part of a description", async () => {
    const page = await listTransactions(
      transactionFiltersSchema.parse({ search: "نان" }),
    );
    expect(page.total).toBe(1);
    expect(page.transactions[0]?.description).toContain("نان");
  });

  it("ignores case", async () => {
    await record({ description: "Netflix Subscription" });
    const page = await listTransactions(
      transactionFiltersSchema.parse({ search: "netflix" }),
    );

    expect(page.total).toBe(1);
  });

  it("returns nothing for a term that matches nothing", async () => {
    expect(
      (await listTransactions(transactionFiltersSchema.parse({ search: "zzzz" })))
        .total,
    ).toBe(0);
  });
});

describe("pagination", () => {
  beforeEach(async () => {
    // All on the same date, so ordering has to fall back to the tiebreaker.
    for (let index = 0; index < 12; index += 1) {
      await record({ amount: "1,000", description: `تراکنش ${index}` });
    }
  });

  it("reports the page, size and totals", async () => {
    const page = await listTransactions(
      transactionFiltersSchema.parse({ page: 1, pageSize: 5 }),
    );

    expect(page).toMatchObject({ page: 1, pageSize: 5, total: 12, totalPages: 3 });
    expect(page.transactions).toHaveLength(5);
  });

  it("returns the remainder on the last page", async () => {
    const page = await listTransactions(
      transactionFiltersSchema.parse({ page: 3, pageSize: 5 }),
    );

    expect(page.transactions).toHaveLength(2);
  });

  it("returns an empty page past the end, not an error", async () => {
    const page = await listTransactions(
      transactionFiltersSchema.parse({ page: 99, pageSize: 5 }),
    );

    expect(page.transactions).toHaveLength(0);
    expect(page.total).toBe(12);
  });

  it("does not repeat or skip a row across pages sharing one date", async () => {
    const seen: string[] = [];

    for (const page of [1, 2, 3]) {
      const result = await listTransactions(
        transactionFiltersSchema.parse({ page, pageSize: 5 }),
      );
      seen.push(...result.transactions.map((t) => t.id));
    }

    expect(seen).toHaveLength(12);
    expect(new Set(seen).size).toBe(12);
  });

  it("reports one page when there is nothing to show", async () => {
    await prisma.transaction.deleteMany();
    const page = await listTransactions(defaults);

    expect(page).toMatchObject({ total: 0, totalPages: 1 });
  });

  it("rejects an out-of-range page size rather than loading everything", () => {
    expect(() => transactionFiltersSchema.parse({ pageSize: 1000 })).toThrow();
    expect(() => transactionFiltersSchema.parse({ page: 0 })).toThrow();
  });
});

describe("ordering", () => {
  it("puts the newest transaction first", async () => {
    await record({ date: "2026-01-01T09:00:00.000Z", description: "قدیمی" });
    await record({ date: "2026-09-01T09:00:00.000Z", description: "جدید" });

    const page = await listTransactions(defaults);
    expect(page.transactions.map((t) => t.description)).toEqual(["جدید", "قدیمی"]);
  });
});
