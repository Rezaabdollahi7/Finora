import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { fromJalaliDate, jalaliMonthRange } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import {
  getCashFlow,
  getDashboardSummary,
  getExpensesByCategory,
  totalBalanceAsOf,
} from "@/features/dashboard/server/dashboard-service";

/** Task 2.1: the aggregated figures, against a real database. */

const MONTH = { year: 1405, month: 6 }; // Shahrivar 1405
const PREVIOUS = { year: 1405, month: 5 };

let bank: Awaited<ReturnType<typeof createAccount>>;
let wallet: Awaited<ReturnType<typeof createAccount>>;
let food: Awaited<ReturnType<typeof createCategory>>;
let groceries: Awaited<ReturnType<typeof createCategory>>;
let restaurant: Awaited<ReturnType<typeof createCategory>>;
let housing: Awaited<ReturnType<typeof createCategory>>;

/** Day `day` of a Jalali month, as the instant to store. */
const on = (month: { year: number; month: number }, day: number) =>
  new Date(fromJalaliDate({ ...month, day }).getTime() + 9 * 3_600_000);

async function tx(input: {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: bigint;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  date: Date;
}) {
  return prisma.transaction.create({
    data: {
      type: input.type,
      amount: input.amount,
      accountId: input.accountId,
      toAccountId: input.toAccountId ?? null,
      categoryId: input.categoryId ?? null,
      owner: "SHARED",
      date: input.date,
    },
  });
}

beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک",
      type: "BANK",
      owner: "SHARED",
      initialBalance: "1,000,000",
    }),
  );
  wallet = await createAccount(
    createAccountSchema.parse({
      name: "کیف پول",
      type: "WALLET",
      owner: "REZA",
      initialBalance: "0",
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
  housing = await createCategory(
    createCategorySchema.parse({ name: "مسکن", kind: "EXPENSE" }),
  );
});

afterAll(async () => {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.$disconnect();
});

describe("monthly income, expenses and savings", () => {
  it("sums only the transactions inside the Jalali month", async () => {
    await tx({ type: "INCOME", amount: 300n, accountId: bank.id, date: on(MONTH, 1) });
    await tx({
      type: "EXPENSE",
      amount: 120n,
      accountId: bank.id,
      date: on(MONTH, 15),
    });
    // Previous month: must not leak into this month's figures.
    await tx({
      type: "INCOME",
      amount: 999n,
      accountId: bank.id,
      date: on(PREVIOUS, 10),
    });

    const { current } = await getDashboardSummary(MONTH);

    expect(current.monthlyIncome).toBe("300");
    expect(current.monthlyExpenses).toBe("120");
    expect(current.monthlySavings).toBe("180");
  });

  it("counts a transaction on the first day and excludes the first of the next month", async () => {
    const { end } = jalaliMonthRange(MONTH);

    await tx({ type: "INCOME", amount: 10n, accountId: bank.id, date: on(MONTH, 1) });
    await tx({ type: "INCOME", amount: 20n, accountId: bank.id, date: end });

    expect((await getDashboardSummary(MONTH)).current.monthlyIncome).toBe("10");
  });

  it("reports negative savings when the household overspends", async () => {
    await tx({ type: "INCOME", amount: 100n, accountId: bank.id, date: on(MONTH, 2) });
    await tx({ type: "EXPENSE", amount: 250n, accountId: bank.id, date: on(MONTH, 3) });

    expect((await getDashboardSummary(MONTH)).current.monthlySavings).toBe("-150");
  });

  it("never counts a transfer as income or expense (rule G.3)", async () => {
    await tx({
      type: "TRANSFER",
      amount: 500n,
      accountId: bank.id,
      toAccountId: wallet.id,
      date: on(MONTH, 5),
    });

    const { current } = await getDashboardSummary(MONTH);

    expect(current.monthlyIncome).toBe("0");
    expect(current.monthlyExpenses).toBe("0");
    expect(current.monthlySavings).toBe("0");
  });

  it("is exact past the floating-point safe range", async () => {
    await tx({
      type: "INCOME",
      amount: 9_007_199_254_740_993n,
      accountId: bank.id,
      date: on(MONTH, 4),
    });

    expect((await getDashboardSummary(MONTH)).current.monthlyIncome).toBe(
      "9007199254740993",
    );
  });
});

describe("total balance", () => {
  it("sums active account balances", async () => {
    await tx({
      type: "INCOME",
      amount: 500n,
      accountId: wallet.id,
      date: on(MONTH, 1),
    });

    // 10,000,000 Rial opening on the bank plus 500 into the wallet.
    expect((await getDashboardSummary(MONTH)).current.totalBalance).toBe("10000500");
  });

  it("excludes archived accounts, which are out of play", async () => {
    await prisma.account.update({ where: { id: bank.id }, data: { isActive: false } });

    expect((await getDashboardSummary(MONTH)).current.totalBalance).toBe("0");
  });

  it("is unchanged by a transfer between household accounts", async () => {
    const before = (await getDashboardSummary(MONTH)).current.totalBalance;

    await tx({
      type: "TRANSFER",
      amount: 400n,
      accountId: bank.id,
      toAccountId: wallet.id,
      date: on(MONTH, 6),
    });

    expect((await getDashboardSummary(MONTH)).current.totalBalance).toBe(before);
  });

  it("is a point in time, not a running total", async () => {
    await tx({ type: "INCOME", amount: 700n, accountId: bank.id, date: on(MONTH, 20) });

    const { start, end } = jalaliMonthRange(MONTH);

    expect(await totalBalanceAsOf(start)).toBe(10_000_000n);
    expect(await totalBalanceAsOf(end)).toBe(10_000_700n);
  });
});

describe("previous month comparison", () => {
  it("reports last month's own income and expenses", async () => {
    await tx({
      type: "INCOME",
      amount: 100n,
      accountId: bank.id,
      date: on(PREVIOUS, 3),
    });
    await tx({
      type: "EXPENSE",
      amount: 40n,
      accountId: bank.id,
      date: on(PREVIOUS, 4),
    });
    await tx({ type: "INCOME", amount: 900n, accountId: bank.id, date: on(MONTH, 3) });

    const { previous, current } = await getDashboardSummary(MONTH);

    expect(previous.monthlyIncome).toBe("100");
    expect(previous.monthlyExpenses).toBe("40");
    expect(current.monthlyIncome).toBe("900");
  });

  it("measures last month's balance at the end of that month", async () => {
    await tx({
      type: "INCOME",
      amount: 200n,
      accountId: bank.id,
      date: on(PREVIOUS, 5),
    });
    await tx({ type: "INCOME", amount: 50n, accountId: bank.id, date: on(MONTH, 5) });

    const { previous, current } = await getDashboardSummary(MONTH);

    expect(previous.totalBalance).toBe("10000200");
    expect(current.totalBalance).toBe("10000250");
  });
});

describe("net worth", () => {
  it("equals account balances while no assets or liabilities are modelled", async () => {
    const { current } = await getDashboardSummary(MONTH);

    expect(current.assetValue).toBe("0");
    expect(current.liabilityValue).toBe("0");
    expect(current.netWorth).toBe(current.totalBalance);
  });
});

describe("period", () => {
  it("labels the month and reports its half-open range", async () => {
    const { period } = await getDashboardSummary(MONTH);
    const range = jalaliMonthRange(MONTH);

    expect(period.label).toBe("شهریور ۱۴۰۵");
    expect(period.start).toBe(range.start.toISOString());
    expect(period.end).toBe(range.end.toISOString());
  });
});

describe("cash flow", () => {
  it("returns one point per month, oldest first, including empty months", async () => {
    await tx({ type: "INCOME", amount: 100n, accountId: bank.id, date: on(MONTH, 2) });

    const points = await getCashFlow(3, MONTH);

    expect(points).toHaveLength(3);
    expect(points.map((p) => p.month)).toEqual([4, 5, 6]);
    expect(points[0]).toMatchObject({ income: "0", expenses: "0", savings: "0" });
    expect(points[2]).toMatchObject({ income: "100", savings: "100" });
  });

  it("puts each transaction in its own Jalali month", async () => {
    await tx({
      type: "EXPENSE",
      amount: 10n,
      accountId: bank.id,
      date: on(PREVIOUS, 1),
    });
    await tx({ type: "EXPENSE", amount: 20n, accountId: bank.id, date: on(MONTH, 1) });

    const points = await getCashFlow(2, MONTH);

    expect(points[0]?.expenses).toBe("10");
    expect(points[1]?.expenses).toBe("20");
  });

  it("excludes transfers", async () => {
    await tx({
      type: "TRANSFER",
      amount: 900n,
      accountId: bank.id,
      toAccountId: wallet.id,
      date: on(MONTH, 8),
    });

    expect((await getCashFlow(1, MONTH))[0]).toMatchObject({
      income: "0",
      expenses: "0",
    });
  });

  it("crosses the Nowruz year boundary", async () => {
    const points = await getCashFlow(3, { year: 1405, month: 2 });

    expect(points.map((p) => `${p.year}/${p.month}`)).toEqual([
      "1404/12",
      "1405/1",
      "1405/2",
    ]);
  });

  it("labels months without the year, for a chart axis", async () => {
    expect((await getCashFlow(1, MONTH))[0]?.label).toBe("شهریور");
  });
});

describe("expenses by category", () => {
  it("rolls subcategories up into their parent", async () => {
    await tx({
      type: "EXPENSE",
      amount: 300n,
      accountId: bank.id,
      categoryId: groceries.id,
      date: on(MONTH, 2),
    });
    await tx({
      type: "EXPENSE",
      amount: 200n,
      accountId: bank.id,
      categoryId: restaurant.id,
      date: on(MONTH, 3),
    });

    const slices = await getExpensesByCategory(MONTH);

    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({
      categoryId: food.id,
      name: "خوراک",
      amount: "500",
    });
  });

  it("keeps separate parents apart and sorts by amount", async () => {
    await tx({
      type: "EXPENSE",
      amount: 100n,
      accountId: bank.id,
      categoryId: groceries.id,
      date: on(MONTH, 2),
    });
    await tx({
      type: "EXPENSE",
      amount: 700n,
      accountId: bank.id,
      categoryId: housing.id,
      date: on(MONTH, 3),
    });

    const slices = await getExpensesByCategory(MONTH);

    expect(slices.map((s) => s.name)).toEqual(["مسکن", "خوراک"]);
  });

  it("gives uncategorised spending its own slice rather than dropping it", async () => {
    await tx({
      type: "EXPENSE",
      amount: 100n,
      accountId: bank.id,
      categoryId: housing.id,
      date: on(MONTH, 2),
    });
    await tx({ type: "EXPENSE", amount: 100n, accountId: bank.id, date: on(MONTH, 3) });

    const slices = await getExpensesByCategory(MONTH);

    expect(slices.map((s) => s.name).sort()).toEqual(["بدون دسته", "مسکن"].sort());
  });

  it("produces shares that add up to one", async () => {
    await tx({
      type: "EXPENSE",
      amount: 250n,
      accountId: bank.id,
      categoryId: groceries.id,
      date: on(MONTH, 2),
    });
    await tx({
      type: "EXPENSE",
      amount: 750n,
      accountId: bank.id,
      categoryId: housing.id,
      date: on(MONTH, 3),
    });

    const slices = await getExpensesByCategory(MONTH);

    expect(slices.map((s) => s.share)).toEqual([0.75, 0.25]);
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 10);
  });

  it("ignores income and transfers", async () => {
    await tx({ type: "INCOME", amount: 500n, accountId: bank.id, date: on(MONTH, 2) });
    await tx({
      type: "TRANSFER",
      amount: 500n,
      accountId: bank.id,
      toAccountId: wallet.id,
      date: on(MONTH, 3),
    });

    expect(await getExpensesByCategory(MONTH)).toEqual([]);
  });

  it("ignores expenses outside the month", async () => {
    await tx({
      type: "EXPENSE",
      amount: 100n,
      accountId: bank.id,
      categoryId: housing.id,
      date: on(PREVIOUS, 2),
    });

    expect(await getExpensesByCategory(MONTH)).toEqual([]);
  });
});
