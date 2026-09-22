import { beforeEach, describe, expect, it } from "vitest";

import { resetLedger } from "@test/reset";
import { absoluteJalaliMonth, fromJalaliDate } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import { createTransactionSchema } from "@/features/transactions/schemas";
import { createTransaction } from "@/features/transactions/server/transaction-service";
import { clearBudgetSchema, setBudgetSchema } from "@/features/budgets/schemas";
import {
  clearBudget,
  getBudgetHistory,
  getBudgetMonth,
  setBudget,
} from "@/features/budgets/server/budget-service";

/** Tasks 5.6–5.10, against a real PostgreSQL database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const MORDAD = absoluteJalaliMonth({ year: 1405, month: 5 });
const SHAHRIVAR = MORDAD + 1;
const MEHR = MORDAD + 2;

/** A moment inside Shahrivar 1405, used as "now" throughout. */
const NOW = jalali(1405, 6, 20);

const toman = (value: number) => String(value);

let bank: Awaited<ReturnType<typeof createAccount>>;
let food: Awaited<ReturnType<typeof createCategory>>;
let restaurants: Awaited<ReturnType<typeof createCategory>>;

async function spend(amount: string, on: string, when: Date) {
  return createTransaction(
    createTransactionSchema.parse({
      type: "EXPENSE",
      amount,
      date: when.toISOString(),
      accountId: bank.id,
      categoryId: on,
      owner: "SHARED",
    }),
  );
}

function lineFor(month: Awaited<ReturnType<typeof getBudgetMonth>>, id: string) {
  const line = month.lines.find((entry) => entry.categoryId === id);
  if (!line) throw new Error(`no budget line for ${id}`);
  return line;
}

beforeEach(async () => {
  await resetLedger();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      initialBalance: toman(500_000_000),
    }),
  );

  food = await createCategory(
    createCategorySchema.parse({ name: "خوراک", kind: "EXPENSE" }),
  );

  restaurants = await createCategory(
    createCategorySchema.parse({
      name: "رستوران",
      kind: "EXPENSE",
      parentId: food.id,
    }),
  );
});

describe("a monthly budget", () => {
  it("reports budget, spent, remaining and the share used", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(18_500_000), food.id, jalali(1405, 6, 10));

    const line = lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id);

    expect(line.amount).toBe("250000000");
    expect(line.spent).toBe("185000000");
    expect(line.remaining).toBe("65000000");
    expect(line.ratio).toBeCloseTo(0.74, 5);
    expect(line.state).toBe("NORMAL");
  });

  it("counts only the month asked for", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: MORDAD,
      }),
    );

    await spend(toman(4_000_000), food.id, jalali(1405, 5, 12));
    await spend(toman(9_000_000), food.id, jalali(1405, 6, 12));

    expect(lineFor(await getBudgetMonth(MORDAD, NOW), food.id).spent).toBe("40000000");
    expect(lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id).spent).toBe(
      "90000000",
    );
  });

  it("counts what a child category spends against its parent's budget", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(5_000_000), food.id, jalali(1405, 6, 3));
    await spend(toman(3_000_000), restaurants.id, jalali(1405, 6, 9));

    // Otherwise the limit would be met by filing every dinner one level down.
    expect(lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id).spent).toBe(
      "80000000",
    );
  });

  it("reports the over-budget state and how far past it went", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(28_000_000), food.id, jalali(1405, 6, 15));

    const month = await getBudgetMonth(SHAHRIVAR, NOW);
    const line = lineFor(month, food.id);

    expect(line.state).toBe("OVER");
    expect(line.remaining).toBe("-30000000");
    expect(month.alerts).toContainEqual({
      kind: "OVER_BUDGET",
      categoryId: food.id,
      categoryName: "خوراک",
      amount: "30000000",
    });
  });

  it("warns at eighty per cent before it warns at a hundred", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(21_000_000), food.id, jalali(1405, 6, 15));

    const month = await getBudgetMonth(SHAHRIVAR, NOW);

    expect(month.alerts.map((alert) => alert.kind)).toEqual(["NEAR_LIMIT"]);
  });

  it("ignores income and transfers, which are not spending", async () => {
    const savings = await createAccount(
      createAccountSchema.parse({
        name: "پس‌انداز",
        type: "WALLET",
        owner: "SHARED",
        initialBalance: toman(0),
      }),
    );

    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    // A transfer between household accounts is never an expense (rule G.3).
    await createTransaction(
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: toman(10_000_000),
        date: jalali(1405, 6, 8).toISOString(),
        accountId: bank.id,
        toAccountId: savings.id,
        owner: "SHARED",
      }),
    );

    expect(lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id).spent).toBe("0");
  });
});

describe("changing a budget", () => {
  it("leaves the months it already applied to alone", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(20_000_000),
        fromMonth: MORDAD,
      }),
    );

    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(30_000_000),
        fromMonth: MEHR,
      }),
    );

    // Rule G.4: raising the budget in Mehr does not rewrite Mordad's.
    expect(lineFor(await getBudgetMonth(MORDAD, NOW), food.id).amount).toBe(
      "200000000",
    );
    expect(lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id).amount).toBe(
      "200000000",
    );
    expect(lineFor(await getBudgetMonth(MEHR, NOW), food.id).amount).toBe("300000000");
  });

  it("edits the window in place when the same month is set twice", async () => {
    for (const amount of [toman(20_000_000), toman(22_000_000)]) {
      await setBudget(
        setBudgetSchema.parse({ categoryId: food.id, amount, fromMonth: SHAHRIVAR }),
      );
    }

    const month = await getBudgetMonth(SHAHRIVAR, NOW);

    expect(month.lines.filter((line) => line.categoryId === food.id)).toHaveLength(1);
    expect(lineFor(month, food.id).amount).toBe("220000000");
  });

  it("stops applying from the month it is cleared, keeping the earlier ones", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(20_000_000),
        fromMonth: MORDAD,
      }),
    );

    await clearBudget(
      clearBudgetSchema.parse({ categoryId: food.id, fromMonth: MEHR }),
    );

    expect(lineFor(await getBudgetMonth(MORDAD, NOW), food.id).amount).toBe(
      "200000000",
    );
    expect(
      (await getBudgetMonth(MEHR, NOW)).lines.some(
        (line) => line.categoryId === food.id,
      ),
    ).toBe(false);
  });

  it("refuses to clear a month that was never budgeted", async () => {
    await expect(
      clearBudget(clearBudgetSchema.parse({ categoryId: food.id, fromMonth: MEHR })),
    ).rejects.toThrow();
  });
});

describe("rollover", () => {
  it("carries an unused remainder into the next month", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: MORDAD,
        rollover: true,
      }),
    );

    await spend(toman(20_000_000), food.id, jalali(1405, 5, 10));

    const line = lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id);

    expect(line.carriedIn).toBe("50000000");
    expect(line.available).toBe("300000000");
  });

  it("carries nothing when the category has rollover off", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: MORDAD,
        rollover: false,
      }),
    );

    await spend(toman(20_000_000), food.id, jalali(1405, 5, 10));

    const line = lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id);

    expect(line.carriedIn).toBe("0");
    expect(line.available).toBe("250000000");
  });

  it("never carries a deficit forward as a debt", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: MORDAD,
        rollover: true,
      }),
    );

    await spend(toman(31_000_000), food.id, jalali(1405, 5, 10));

    expect(lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id).carriedIn).toBe("0");
  });

  it("starts each category's chain at its own window, not the earliest one", async () => {
    // Food's window opens a month before restaurants'. The month they do not
    // share is food's history, and crediting restaurants with the surplus
    // from it would hand it money from before it was budgeted at all.
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: MORDAD,
        rollover: true,
      }),
    );

    await setBudget(
      setBudgetSchema.parse({
        categoryId: restaurants.id,
        amount: toman(5_000_000),
        fromMonth: SHAHRIVAR,
        rollover: true,
      }),
    );

    // Mordad: nothing spent on restaurants, so it has a surplus — but only
    // if it is wrongly measured over a month its budget did not cover.
    await spend(toman(1_000_000), food.id, jalali(1405, 5, 10));

    const month = await getBudgetMonth(SHAHRIVAR, NOW);

    expect(lineFor(month, restaurants.id).carriedIn).toBe("0");
    // Food's own window did start in Mordad, so its carry is real.
    expect(lineFor(month, food.id).carriedIn).toBe("240000000");
  });

  it("does not credit a budget with a surplus from before it existed", async () => {
    // The window opens in Shahrivar, so Mordad's quiet month is not its
    // surplus to carry.
    await spend(toman(1_000_000), food.id, jalali(1405, 5, 10));

    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
        rollover: true,
      }),
    );

    expect(lineFor(await getBudgetMonth(SHAHRIVAR, NOW), food.id).carriedIn).toBe("0");
  });
});

describe("the month's totals", () => {
  it("counts a child's spending once, not once per budgeted ancestor", async () => {
    for (const [categoryId, amount] of [
      [food.id, toman(25_000_000)],
      [restaurants.id, toman(5_000_000)],
    ] as const) {
      await setBudget(
        setBudgetSchema.parse({ categoryId, amount, fromMonth: SHAHRIVAR }),
      );
    }

    await spend(toman(3_000_000), restaurants.id, jalali(1405, 6, 9));

    const month = await getBudgetMonth(SHAHRIVAR, NOW);

    // Both lines see the dinner, because both budgets cover it …
    expect(lineFor(month, food.id).spent).toBe("30000000");
    expect(lineFor(month, restaurants.id).spent).toBe("30000000");
    // … but the household only ate it once.
    expect(month.totals.spent).toBe("30000000");
    expect(month.totals.amount).toBe("250000000");
  });

  it("is empty and calm when nothing is budgeted", async () => {
    const month = await getBudgetMonth(SHAHRIVAR, NOW);

    expect(month.lines).toEqual([]);
    expect(month.totals).toMatchObject({
      amount: "0",
      spent: "0",
      remaining: "0",
      state: "NORMAL",
    });
  });
});

describe("history", () => {
  it("gives each month its own budget and spending", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(20_000_000),
        fromMonth: MORDAD,
      }),
    );

    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(30_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(19_000_000), food.id, jalali(1405, 5, 10));
    await spend(toman(33_000_000), food.id, jalali(1405, 6, 10));

    const history = await getBudgetHistory(food.id, SHAHRIVAR, 2);

    expect(history).toMatchObject([
      { month: MORDAD, amount: "200000000", spent: "190000000", state: "WARNING" },
      { month: SHAHRIVAR, amount: "300000000", spent: "330000000", state: "OVER" },
    ]);
  });
});
