import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount, getAccount } from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
} from "@/features/categories/server/category-service";
import {
  categoryFiltersSchema,
  updateCategorySchema,
} from "@/features/categories/schemas";
import { createTransactionSchema } from "@/features/transactions/schemas";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction-service";

/**
 * Task 1.10, the parts not already covered by the rules and CRUD suites:
 * category assignment, and the balance staying correct across the whole
 * lifecycle of a transaction.
 */

const DATE = "2026-09-21T09:00:00.000Z";

let bank: Awaited<ReturnType<typeof createAccount>>;
let wallet: Awaited<ReturnType<typeof createAccount>>;
let expenseParent: Awaited<ReturnType<typeof createCategory>>;
let groceries: Awaited<ReturnType<typeof createCategory>>;
let salary: Awaited<ReturnType<typeof createCategory>>;

async function record(input: Record<string, unknown>) {
  return createTransaction(
    createTransactionSchema.parse({ owner: "SHARED", date: DATE, ...input }),
  );
}

const balanceOf = async (id: string) => BigInt((await getAccount(id))!.balance);

beforeEach(async () => {
  await resetLedger();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "10,000,000",
    }),
  );
  wallet = await createAccount(
    createAccountSchema.parse({
      name: "کیف پول",
      type: "WALLET",
      owner: "REZA",
      initialBalance: "1,000,000",
    }),
  );

  expenseParent = await createCategory(
    createCategorySchema.parse({ name: "خوراک", kind: "EXPENSE" }),
  );
  groceries = await createCategory(
    createCategorySchema.parse({
      name: "خواربار",
      kind: "EXPENSE",
      parentId: expenseParent.id,
    }),
  );
  salary = await createCategory(
    createCategorySchema.parse({ name: "حقوق", kind: "INCOME" }),
  );
});

afterAll(async () => {
  await resetLedger();
  await prisma.$disconnect();
});

describe("category assignment", () => {
  it("files an expense under an expense category and resolves its name", async () => {
    const transaction = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    expect(transaction.categoryId).toBe(groceries.id);
    expect(transaction.categoryName).toBe("خواربار");
  });

  it("files income under an income category", async () => {
    const transaction = await record({
      type: "INCOME",
      amount: "30,000,000",
      accountId: bank.id,
      categoryId: salary.id,
    });

    expect(transaction.categoryName).toBe("حقوق");
  });

  it("allows a transaction with no category at all", async () => {
    const transaction = await record({
      type: "EXPENSE",
      amount: "1,000",
      accountId: bank.id,
    });

    expect(transaction.categoryId).toBeNull();
    expect(transaction.categoryName).toBeNull();
  });

  it("refuses an expense filed under an income category", async () => {
    await expect(
      record({
        type: "EXPENSE",
        amount: "1,000",
        accountId: bank.id,
        categoryId: salary.id,
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_KIND_MISMATCH", status: 409 });
  });

  it("refuses income filed under an expense category", async () => {
    await expect(
      record({
        type: "INCOME",
        amount: "1,000",
        accountId: bank.id,
        categoryId: groceries.id,
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_KIND_MISMATCH" });
  });

  it("refuses an archived category on a new transaction", async () => {
    await archiveCategory(groceries.id);

    await expect(
      record({
        type: "EXPENSE",
        amount: "1,000",
        accountId: bank.id,
        categoryId: groceries.id,
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_ARCHIVED" });
  });

  it("reports an unknown category as 404", async () => {
    await expect(
      record({
        type: "EXPENSE",
        amount: "1,000",
        accountId: bank.id,
        categoryId: "nope",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("can move a transaction to a different category", async () => {
    const restaurant = await createCategory(
      createCategorySchema.parse({
        name: "رستوران",
        kind: "EXPENSE",
        parentId: expenseParent.id,
      }),
    );
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    const moved = await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "100,000",
        accountId: bank.id,
        categoryId: restaurant.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(moved.categoryName).toBe("رستوران");
  });

  it("can clear a category", async () => {
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    const cleared = await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "100,000",
        accountId: bank.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(cleared.categoryId).toBeNull();
  });

  it("drops the category when an expense becomes a transfer", async () => {
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    const moved = await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: "100,000",
        accountId: bank.id,
        toAccountId: wallet.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(moved.categoryId).toBeNull();
  });

  it("keeps history readable when a category is renamed (rule G.4)", async () => {
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    await updateCategory(
      groceries.id,
      updateCategorySchema.parse({ name: "خرید خانه" }),
    );

    const after = await getTransaction(created.id);
    expect(after?.categoryId).toBe(groceries.id);
    expect(after?.categoryName).toBe("خرید خانه");
  });

  it("keeps history when a category is archived", async () => {
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    await archiveCategory(groceries.id);

    expect((await getTransaction(created.id))?.categoryName).toBe("خواربار");
  });

  it("counts transactions per category", async () => {
    await record({
      type: "EXPENSE",
      amount: "1,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });
    await record({
      type: "EXPENSE",
      amount: "2,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });

    const listed = await listCategories(categoryFiltersSchema.parse({}));
    expect(listed.find((c) => c.id === groceries.id)?.transactionCount).toBe(2);
    expect(listed.find((c) => c.id === expenseParent.id)?.transactionCount).toBe(0);
  });
});

describe("balance across a transaction's whole life", () => {
  it("returns to the opening balance after create then delete", async () => {
    const opening = await balanceOf(bank.id);

    const created = await record({
      type: "EXPENSE",
      amount: "250,000",
      accountId: bank.id,
      categoryId: groceries.id,
    });
    expect(await balanceOf(bank.id)).toBe(opening - 2_500_000n);

    await deleteTransaction(created.id);
    expect(await balanceOf(bank.id)).toBe(opening);
  });

  it("follows an amount change", async () => {
    const opening = await balanceOf(bank.id);
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
    });

    await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "400,000",
        accountId: bank.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(await balanceOf(bank.id)).toBe(opening - 4_000_000n);
  });

  it("moves the money when a transaction changes account", async () => {
    const bankOpening = await balanceOf(bank.id);
    const walletOpening = await balanceOf(wallet.id);

    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
    });

    await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: "100,000",
        accountId: wallet.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(await balanceOf(bank.id)).toBe(bankOpening);
    expect(await balanceOf(wallet.id)).toBe(walletOpening - 1_000_000n);
  });

  it("undoes both sides when a transfer is deleted", async () => {
    const bankOpening = await balanceOf(bank.id);
    const walletOpening = await balanceOf(wallet.id);

    const created = await record({
      type: "TRANSFER",
      amount: "300,000",
      accountId: bank.id,
      toAccountId: wallet.id,
    });

    expect(await balanceOf(bank.id)).toBe(bankOpening - 3_000_000n);
    expect(await balanceOf(wallet.id)).toBe(walletOpening + 3_000_000n);

    await deleteTransaction(created.id);

    expect(await balanceOf(bank.id)).toBe(bankOpening);
    expect(await balanceOf(wallet.id)).toBe(walletOpening);
  });

  it("switching an expense to income swings the balance by twice the amount", async () => {
    const opening = await balanceOf(bank.id);
    const created = await record({
      type: "EXPENSE",
      amount: "100,000",
      accountId: bank.id,
    });

    await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "INCOME",
        amount: "100,000",
        accountId: bank.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(await balanceOf(bank.id)).toBe(opening + 1_000_000n);
  });

  it("keeps the household total unchanged when a transfer is edited", async () => {
    const total = async () => (await balanceOf(bank.id)) + (await balanceOf(wallet.id));
    const before = await total();

    const created = await record({
      type: "TRANSFER",
      amount: "200,000",
      accountId: bank.id,
      toAccountId: wallet.id,
    });
    expect(await total()).toBe(before);

    await updateTransaction(
      created.id,
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: "450,000",
        accountId: bank.id,
        toAccountId: wallet.id,
        owner: "SHARED",
        date: DATE,
      }),
    );

    expect(await total()).toBe(before);
  });
});
