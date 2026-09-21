import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import {
  transactionFiltersSchema,
  UNCATEGORISED,
} from "@/features/transactions/schemas";
import { listTransactions } from "@/features/transactions/server/transaction-service";

/** Task 1.8: date range, account, owner, category, type and amount range. */

let bank: Awaited<ReturnType<typeof createAccount>>;
let wallet: Awaited<ReturnType<typeof createAccount>>;
let food: Awaited<ReturnType<typeof createCategory>>;
let groceries: Awaited<ReturnType<typeof createCategory>>;
let restaurant: Awaited<ReturnType<typeof createCategory>>;

const filters = (input: Record<string, unknown> = {}) =>
  transactionFiltersSchema.parse(input);

const names = async (input: Record<string, unknown> = {}) =>
  (await listTransactions(filters(input))).transactions
    .map((t) => t.description)
    .sort();

beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "100,000,000",
    }),
  );
  wallet = await createAccount(
    createAccountSchema.parse({
      name: "کیف پول",
      type: "WALLET",
      owner: "REZA",
      initialBalance: "10,000,000",
    }),
  );

  food = await createCategory(
    createCategorySchema.parse({ name: "خوراک", kind: "EXPENSE" }),
  );
  groceries = await createCategory(
    createCategorySchema.parse({ name: "خواربار", kind: "EXPENSE", parentId: food.id }),
  );
  restaurant = await createCategory(
    createCategorySchema.parse({ name: "رستوران", kind: "EXPENSE", parentId: food.id }),
  );

  const rows = [
    {
      description: "خواربار فروردین",
      type: "EXPENSE" as const,
      amount: 1_000_000n,
      accountId: bank.id,
      categoryId: groceries.id,
      owner: "SHARED" as const,
      date: new Date("2026-04-05T09:00:00Z"),
    },
    {
      description: "رستوران اردیبهشت",
      type: "EXPENSE" as const,
      amount: 5_000_000n,
      accountId: bank.id,
      categoryId: restaurant.id,
      owner: "REZA" as const,
      date: new Date("2026-05-10T09:00:00Z"),
    },
    {
      description: "حقوق",
      type: "INCOME" as const,
      amount: 300_000_000n,
      accountId: bank.id,
      categoryId: null,
      owner: "YEGANEH" as const,
      date: new Date("2026-06-01T09:00:00Z"),
    },
    {
      description: "انتقال به کیف پول",
      type: "TRANSFER" as const,
      amount: 2_000_000n,
      accountId: bank.id,
      toAccountId: wallet.id,
      categoryId: null,
      owner: "SHARED" as const,
      date: new Date("2026-06-15T09:00:00Z"),
    },
  ];

  for (const row of rows) await prisma.transaction.create({ data: row });
});

afterAll(async () => {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.$disconnect();
});

describe("date range", () => {
  it("includes both ends of the range", async () => {
    expect(
      await names({ dateFrom: "2026-04-05T09:00:00Z", dateTo: "2026-05-10T09:00:00Z" }),
    ).toEqual(["خواربار فروردین", "رستوران اردیبهشت"]);
  });

  it("accepts an open-ended range in either direction", async () => {
    expect(await names({ dateFrom: "2026-06-01T00:00:00Z" })).toEqual([
      "انتقال به کیف پول",
      "حقوق",
    ]);
    expect(await names({ dateTo: "2026-04-30T00:00:00Z" })).toEqual([
      "خواربار فروردین",
    ]);
  });

  it("rejects a reversed range instead of silently returning nothing", () => {
    expect(() =>
      filters({ dateFrom: "2026-06-01T00:00:00Z", dateTo: "2026-01-01T00:00:00Z" }),
    ).toThrow();
  });

  it("treats a blank bound as no bound", async () => {
    expect(await names({ dateFrom: "", dateTo: "" })).toHaveLength(4);
  });
});

describe("amount range", () => {
  it("filters on the stored Rial value, converted from the Toman given", async () => {
    // 500,000 Toman is 5,000,000 Rial: the restaurant entry exactly.
    expect(await names({ amountMin: "500,000", amountMax: "500,000" })).toEqual([
      "رستوران اردیبهشت",
    ]);
  });

  it("includes both ends", async () => {
    // 100,000 and 500,000 Toman are the grocery and restaurant amounts
    // exactly; the 200,000 Toman transfer sits between them.
    expect(await names({ amountMin: "100,000", amountMax: "500,000" })).toEqual([
      "انتقال به کیف پول",
      "خواربار فروردین",
      "رستوران اردیبهشت",
    ]);
  });

  it("accepts an open-ended range", async () => {
    expect(await names({ amountMin: "1,000,000" })).toEqual(["حقوق"]);
  });

  it("rejects a reversed range and a negative bound", () => {
    expect(() => filters({ amountMin: "500", amountMax: "100" })).toThrow();
    expect(() => filters({ amountMin: "-5" })).toThrow();
  });
});

describe("category", () => {
  it("matches a leaf category", async () => {
    expect(await names({ categoryId: groceries.id })).toEqual(["خواربار فروردین"]);
  });

  it("rolls a parent up over its children", async () => {
    expect(await names({ categoryId: food.id })).toEqual([
      "خواربار فروردین",
      "رستوران اردیبهشت",
    ]);
  });

  it("finds uncategorised entries without drowning in transfers", async () => {
    // A transfer has no category by design, so listing it here would bury
    // the one income that genuinely still needs classifying.
    expect(await names({ categoryId: UNCATEGORISED })).toEqual(["حقوق"]);
  });
});

describe("combining filters", () => {
  it("applies every filter together", async () => {
    expect(
      await names({
        type: "EXPENSE",
        accountId: bank.id,
        owner: "REZA",
        categoryId: food.id,
        dateFrom: "2026-05-01T00:00:00Z",
        amountMin: "100,000",
      }),
    ).toEqual(["رستوران اردیبهشت"]);
  });

  it("keeps the account filter's OR from swallowing the others", async () => {
    // The account clause expands to an OR internally. If it sat at the top
    // level it would override the type filter and return transfers too.
    expect(await names({ accountId: bank.id, type: "INCOME" })).toEqual(["حقوق"]);
  });

  it("combines search with a filter", async () => {
    expect(await names({ search: "رستوران", type: "EXPENSE" })).toEqual([
      "رستوران اردیبهشت",
    ]);
  });

  it("returns nothing when the filters cannot all hold", async () => {
    expect(await names({ type: "INCOME", categoryId: groceries.id })).toEqual([]);
  });

  it("reports totals for the filtered set, not the whole ledger", async () => {
    const page = await listTransactions(filters({ type: "EXPENSE", pageSize: 1 }));

    expect(page.total).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.transactions).toHaveLength(1);
  });
});
