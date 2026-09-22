import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import {
  categoryFiltersSchema,
  createCategorySchema,
  updateCategorySchema,
} from "@/features/categories/schemas";
import {
  archiveCategory,
  createCategory,
  listCategories,
  listCategoryTree,
  restoreCategory,
  updateCategory,
} from "@/features/categories/server/category-service";

const defaults = categoryFiltersSchema.parse({});

async function root(name: string, kind: "INCOME" | "EXPENSE" = "EXPENSE") {
  return createCategory(createCategorySchema.parse({ name, kind }));
}

async function child(
  name: string,
  parentId: string,
  kind: "INCOME" | "EXPENSE" = "EXPENSE",
) {
  return createCategory(createCategorySchema.parse({ name, kind, parentId }));
}

beforeEach(async () => {
  await resetLedger();
});

afterAll(async () => {
  await resetLedger();
  await prisma.$disconnect();
});

describe("hierarchy", () => {
  it("nests children under their parent", async () => {
    const food = await root("خوراک");
    await child("خواربار", food.id);
    await child("رستوران", food.id);

    const tree = await listCategoryTree(defaults);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe("خوراک");
    expect(tree[0]?.children.map((c) => c.name)).toEqual(["خواربار", "رستوران"]);
  });

  it("records the parent's name on a child", async () => {
    const food = await root("خوراک");
    const groceries = await child("خواربار", food.id);

    expect(groceries.parentId).toBe(food.id);
    expect(groceries.parentName).toBe("خوراک");
  });

  it("refuses a third level", async () => {
    const food = await root("خوراک");
    const groceries = await child("خواربار", food.id);

    await expect(child("میوه", groceries.id)).rejects.toMatchObject({
      code: "CATEGORY_TOO_DEEP",
      status: 409,
    });
  });

  it("refuses a child whose kind differs from its parent", async () => {
    const food = await root("خوراک", "EXPENSE");

    await expect(child("حقوق", food.id, "INCOME")).rejects.toMatchObject({
      code: "CATEGORY_KIND_MISMATCH",
    });
  });

  it("reports an unknown parent as 404", async () => {
    await expect(child("x", "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a child under an archived parent", async () => {
    const food = await root("خوراک");
    await archiveCategory(food.id);

    await expect(child("خواربار", food.id)).rejects.toMatchObject({
      code: "CATEGORY_PARENT_ARCHIVED",
    });
  });
});

describe("uniqueness", () => {
  it("refuses two top-level categories with the same name and kind", async () => {
    await root("خوراک");
    await expect(root("خوراک")).rejects.toThrow();
  });

  it("allows the same name on different sides of the ledger", async () => {
    await root("سایر", "EXPENSE");
    await expect(root("سایر", "INCOME")).resolves.toMatchObject({ kind: "INCOME" });
  });

  it("refuses two siblings with the same name", async () => {
    const food = await root("خوراک");
    await child("خواربار", food.id);

    await expect(child("خواربار", food.id)).rejects.toThrow();
  });

  it("allows the same child name under different parents", async () => {
    const food = await root("خوراک");
    const personal = await root("شخصی");
    await child("سایر", food.id);

    await expect(child("سایر", personal.id)).resolves.toMatchObject({ name: "سایر" });
  });
});

describe("filters", () => {
  it("filters by kind", async () => {
    await root("خوراک", "EXPENSE");
    await root("حقوق", "INCOME");

    const income = await listCategories(
      categoryFiltersSchema.parse({ kind: "INCOME" }),
    );
    expect(income.map((c) => c.name)).toEqual(["حقوق"]);
  });

  it("hides archived categories unless asked", async () => {
    const food = await root("خوراک");
    await archiveCategory(food.id);

    expect(await listCategories(defaults)).toHaveLength(0);
    expect(
      await listCategories(categoryFiltersSchema.parse({ includeArchived: true })),
    ).toHaveLength(1);
  });

  it("orders by sortOrder then name", async () => {
    await createCategory(
      createCategorySchema.parse({ name: "ب", kind: "EXPENSE", sortOrder: 1 }),
    );
    await createCategory(
      createCategorySchema.parse({ name: "الف", kind: "EXPENSE", sortOrder: 0 }),
    );
    await createCategory(
      createCategorySchema.parse({ name: "آ", kind: "EXPENSE", sortOrder: 0 }),
    );

    const names = (await listCategories(defaults)).map((c) => c.name);
    expect(names[0]).toBe("آ");
    expect(names[2]).toBe("ب");
  });
});

describe("editing", () => {
  it("renames without touching anything else", async () => {
    const food = await root("خوراک");
    const renamed = await updateCategory(
      food.id,
      updateCategorySchema.parse({ name: "خوردنی" }),
    );

    expect(renamed.name).toBe("خوردنی");
    expect(renamed.kind).toBe(food.kind);
  });

  it("does not accept a change of kind or parent", () => {
    // Both would reclassify every transaction already filed under the
    // category, so they are simply not part of the update shape (rule G.4).
    const parsed = updateCategorySchema.parse({
      name: "x",
      kind: "INCOME",
      parentId: "y",
    } as Record<string, unknown>);

    expect(parsed).not.toHaveProperty("kind");
    expect(parsed).not.toHaveProperty("parentId");
  });

  it("rejects an empty update", () => {
    expect(() => updateCategorySchema.parse({})).toThrow();
  });
});

describe("archive and restore", () => {
  it("archives children along with their parent", async () => {
    const food = await root("خوراک");
    const groceries = await child("خواربار", food.id);
    await archiveCategory(food.id);

    const all = await listCategories(
      categoryFiltersSchema.parse({ includeArchived: true }),
    );
    expect(all.find((c) => c.id === groceries.id)?.isActive).toBe(false);
  });

  it("refuses to restore a child while its parent is archived", async () => {
    const food = await root("خوراک");
    const groceries = await child("خواربار", food.id);
    await archiveCategory(food.id);

    await expect(restoreCategory(groceries.id)).rejects.toMatchObject({
      code: "CATEGORY_PARENT_ARCHIVED",
    });

    await restoreCategory(food.id);
    await expect(restoreCategory(groceries.id)).resolves.toMatchObject({
      isActive: true,
    });
  });

  it("rejects archiving twice", async () => {
    const food = await root("خوراک");
    await archiveCategory(food.id);

    await expect(archiveCategory(food.id)).rejects.toMatchObject({
      code: "ALREADY_ARCHIVED",
    });
  });

  it("keeps the row, so transactions filed under it still resolve", async () => {
    const food = await root("خوراک");
    await archiveCategory(food.id);

    expect(await prisma.category.findUnique({ where: { id: food.id } })).not.toBeNull();
  });
});

describe("transaction counts", () => {
  it("counts the transactions filed under a category", async () => {
    const account = await prisma.account.create({
      data: {
        name: "بانک",
        type: "BANK",
        owner: "SHARED",
        initialBalance: 100_000_000n,
      },
    });
    const food = await root("خوراک");

    await prisma.transaction.create({
      data: {
        type: "EXPENSE",
        amount: 10_000n,
        accountId: account.id,
        categoryId: food.id,
        owner: "SHARED",
        date: new Date("2026-09-21T09:00:00Z"),
      },
    });

    const listed = await listCategories(defaults);
    expect(listed.find((c) => c.id === food.id)?.transactionCount).toBe(1);
  });

  it("refuses to delete a category that has transactions", async () => {
    const account = await prisma.account.create({
      data: {
        name: "بانک",
        type: "BANK",
        owner: "SHARED",
        initialBalance: 100_000_000n,
      },
    });
    const food = await root("خوراک");

    await prisma.transaction.create({
      data: {
        type: "EXPENSE",
        amount: 10_000n,
        accountId: account.id,
        categoryId: food.id,
        owner: "SHARED",
        date: new Date("2026-09-21T09:00:00Z"),
      },
    });

    // The foreign key is RESTRICT, so history cannot be orphaned even by a
    // direct database call (rule G.4).
    await expect(prisma.category.delete({ where: { id: food.id } })).rejects.toThrow();
  });
});
