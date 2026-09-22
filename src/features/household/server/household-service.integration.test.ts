import { beforeEach, describe, expect, it } from "vitest";

import { resetLedger } from "@test/reset";
import { absoluteJalaliMonth, fromJalaliDate, jalaliMonthOf } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import { createTransactionSchema } from "@/features/transactions/schemas";
import { createTransaction } from "@/features/transactions/server/transaction-service";
import { setBudgetSchema } from "@/features/budgets/schemas";
import { setBudget } from "@/features/budgets/server/budget-service";
import { createGoalSchema } from "@/features/goals/schemas";
import { createGoal } from "@/features/goals/server/goal-service";
import { getHouseholdMonth } from "@/features/household/server/household-service";

/** Tasks 7.3–7.9, against a real PostgreSQL database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const NOW = jalali(1405, 6, 20);
const SHAHRIVAR = absoluteJalaliMonth(jalaliMonthOf(NOW));
const toman = (value: number) => String(value);

let joint: Awaited<ReturnType<typeof createAccount>>;
let rezaAccount: Awaited<ReturnType<typeof createAccount>>;
let yeganehAccount: Awaited<ReturnType<typeof createAccount>>;
let food: Awaited<ReturnType<typeof createCategory>>;
let salary: Awaited<ReturnType<typeof createCategory>>;

const member = (owner: string) => (m: { owner: string }) => m.owner === owner;

beforeEach(async () => {
  await resetLedger();

  joint = await createAccount(
    createAccountSchema.parse({
      name: "حساب مشترک",
      type: "BANK",
      owner: "SHARED",
      initialBalance: toman(10_000_000),
    }),
  );
  rezaAccount = await createAccount(
    createAccountSchema.parse({
      name: "حساب رضا",
      type: "BANK",
      owner: "REZA",
      initialBalance: toman(5_000_000),
    }),
  );
  yeganehAccount = await createAccount(
    createAccountSchema.parse({
      name: "حساب یگانه",
      type: "BANK",
      owner: "YEGANEH",
      initialBalance: toman(3_000_000),
    }),
  );

  food = await createCategory(
    createCategorySchema.parse({ name: "خوراک", kind: "EXPENSE" }),
  );
  salary = await createCategory(
    createCategorySchema.parse({ name: "حقوق", kind: "INCOME" }),
  );
});

const earn = (amount: string, owner: string, into: { id: string }) =>
  createTransaction(
    createTransactionSchema.parse({
      type: "INCOME",
      amount,
      date: jalali(1405, 6, 3).toISOString(),
      accountId: into.id,
      categoryId: salary.id,
      owner,
    }),
  );

const spend = (amount: string, owner: string, from: { id: string }) =>
  createTransaction(
    createTransactionSchema.parse({
      type: "EXPENSE",
      amount,
      date: jalali(1405, 6, 8).toISOString(),
      accountId: from.id,
      categoryId: food.id,
      owner,
    }),
  );

const move = (
  amount: string,
  from: { id: string },
  to: { id: string },
  owner: string,
) =>
  createTransaction(
    createTransactionSchema.parse({
      type: "TRANSFER",
      amount,
      date: jalali(1405, 6, 5).toISOString(),
      accountId: from.id,
      toAccountId: to.id,
      owner,
    }),
  );

describe("income ownership", () => {
  it("tracks what each person earned separately, as task 7.3 asks", async () => {
    await earn(toman(30_000_000), "REZA", rezaAccount);
    await earn(toman(5_000_000), "REZA", rezaAccount);
    await earn(toman(30_000_000), "YEGANEH", yeganehAccount);

    const result = await getHouseholdMonth(SHAHRIVAR, NOW);

    expect(result.members.find(member("REZA"))!.totals.income).toBe("350000000");
    expect(result.members.find(member("YEGANEH"))!.totals.income).toBe("300000000");
    expect(result.household.income).toBe("650000000");
  });

  it("counts a month's own transactions and no other month's", async () => {
    await earn(toman(30_000_000), "REZA", rezaAccount);

    await createTransaction(
      createTransactionSchema.parse({
        type: "INCOME",
        amount: toman(99_000_000),
        date: jalali(1405, 5, 3).toISOString(),
        accountId: rezaAccount.id,
        categoryId: salary.id,
        owner: "REZA",
      }),
    );

    expect((await getHouseholdMonth(SHAHRIVAR, NOW)).household.income).toBe(
      "300000000",
    );
  });
});

describe("shared and personal expenses", () => {
  it("keeps household costs apart from each person's own", async () => {
    await spend(toman(38_000_000), "SHARED", joint);
    await spend(toman(4_000_000), "REZA", rezaAccount);
    await spend(toman(2_500_000), "YEGANEH", yeganehAccount);

    const result = await getHouseholdMonth(SHAHRIVAR, NOW);

    expect(result.shared.expenses).toBe("380000000");
    expect(result.members.find(member("REZA"))!.totals.expenses).toBe("40000000");
    expect(result.members.find(member("YEGANEH"))!.totals.expenses).toBe("25000000");
    expect(result.household.expenses).toBe("445000000");
  });

  it("a personal expense does not touch the household's budget", async () => {
    // Task 7.5: the household budgets food; Reza buys his own lunch.
    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        amount: toman(20_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(6_000_000), "SHARED", joint);
    await spend(toman(9_000_000), "REZA", rezaAccount);

    const { getBudgetMonth } = await import("@/features/budgets/server/budget-service");

    const household = await getBudgetMonth(SHAHRIVAR, NOW, "SHARED");

    expect(household.totals.spent).toBe("60000000");
  });

  it("a personal budget measures only that person's spending", async () => {
    const { getBudgetMonth } = await import("@/features/budgets/server/budget-service");

    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        owner: "REZA",
        amount: toman(10_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await spend(toman(9_000_000), "REZA", rezaAccount);
    await spend(toman(30_000_000), "SHARED", joint);
    await spend(toman(2_000_000), "YEGANEH", yeganehAccount);

    const reza = await getBudgetMonth(SHAHRIVAR, NOW, "REZA");

    expect(reza.totals.spent).toBe("90000000");
    expect(reza.totals.amount).toBe("100000000");
    expect(reza.owner).toBe("REZA");
  });

  it("lets the household and a person budget the same category at once", async () => {
    const { getBudgetMonth } = await import("@/features/budgets/server/budget-service");

    for (const owner of ["SHARED", "REZA"] as const) {
      await setBudget(
        setBudgetSchema.parse({
          categoryId: food.id,
          owner,
          amount: owner === "SHARED" ? toman(20_000_000) : toman(10_000_000),
          fromMonth: SHAHRIVAR,
        }),
      );
    }

    expect((await getBudgetMonth(SHAHRIVAR, NOW, "SHARED")).lines).toHaveLength(1);
    expect((await getBudgetMonth(SHAHRIVAR, NOW, "REZA")).lines).toHaveLength(1);
    expect((await getBudgetMonth(SHAHRIVAR, NOW, "YEGANEH")).lines).toEqual([]);
  });
});

describe("contributions", () => {
  it("counts a shared cost paid out of a person's own account", async () => {
    await spend(toman(38_000_000), "SHARED", rezaAccount);

    const reza = (await getHouseholdMonth(SHAHRIVAR, NOW)).contributions.find(
      member("REZA"),
    )!;

    expect(reza.direct).toBe("380000000");
    expect(reza.total).toBe("380000000");
  });

  it("counts money moved into the shared account", async () => {
    await move(toman(10_000_000), yeganehAccount, joint, "YEGANEH");

    const yeganeh = (await getHouseholdMonth(SHAHRIVAR, NOW)).contributions.find(
      member("YEGANEH"),
    )!;

    expect(yeganeh.pooled).toBe("100000000");
    expect(yeganeh.total).toBe("100000000");
  });

  it("credits nobody for spending money that was already pooled", async () => {
    await spend(toman(9_000_000), "SHARED", joint);

    const result = await getHouseholdMonth(SHAHRIVAR, NOW);

    for (const contribution of result.contributions) {
      expect(contribution.total).toBe("0");
    }
  });

  it("does not treat earning as contributing", async () => {
    await earn(toman(30_000_000), "REZA", rezaAccount);

    expect(
      (await getHouseholdMonth(SHAHRIVAR, NOW)).contributions.find(member("REZA"))!
        .total,
    ).toBe("0");
  });

  it("lists both people even when only one has contributed", async () => {
    // Task 7.7 is informational: nobody disappears from the list for having
    // put in nothing this month.
    await spend(toman(38_000_000), "SHARED", rezaAccount);

    const result = await getHouseholdMonth(SHAHRIVAR, NOW);

    expect(result.contributions.map((c) => c.owner)).toEqual(["REZA", "YEGANEH"]);
    expect(result.contributions.find(member("YEGANEH"))!.total).toBe("0");
  });
});

describe("what the household holds", () => {
  it("counts only the assets and debts owned jointly", async () => {
    const { createAssetSchema } = await import("@/features/assets/schemas");
    const { createAsset } = await import("@/features/assets/server/asset-service");
    const { createLoanSchema } = await import("@/features/loans/schemas");
    const { createLoan } = await import("@/features/loans/server/loan-service");

    for (const [name, owner] of [
      ["خانه", "SHARED"],
      ["طلای رضا", "REZA"],
    ] as const) {
      await createAsset(
        createAssetSchema.parse({
          name,
          type: "PROPERTY",
          owner,
          purchaseUnitPrice: toman(100_000_000),
          purchaseDate: jalali(1404, 1, 1).toISOString(),
        }),
      );
    }

    await createLoan(
      createLoanSchema.parse({
        name: "وام مسکن",
        provider: "بانک مسکن",
        principalAmount: toman(50_000_000),
        installmentAmount: toman(5_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 6, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: joint.id,
      }),
      NOW,
    );

    await createLoan(
      createLoanSchema.parse({
        name: "وام شخصی رضا",
        provider: "بانک ملت",
        principalAmount: toman(20_000_000),
        installmentAmount: toman(2_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 6, 1).toISOString(),
        paymentDay: 10,
        owner: "REZA",
        accountId: rezaAccount.id,
      }),
      NOW,
    );

    const result = await getHouseholdMonth(SHAHRIVAR, NOW);

    expect(result.sharedAssets).toBe("1000000000");
    expect(result.sharedLiabilities).toBe("600000000");
  });
});

describe("each person's own view", () => {
  it("shows their accounts, their budgets and their goals", async () => {
    await earn(toman(30_000_000), "REZA", rezaAccount);
    await spend(toman(4_000_000), "REZA", rezaAccount);

    await setBudget(
      setBudgetSchema.parse({
        categoryId: food.id,
        owner: "REZA",
        amount: toman(10_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await createGoal(
      createGoalSchema.parse({
        name: "لپ‌تاپ",
        kind: "PURCHASE",
        targetAmount: toman(45_000_000),
        owner: "REZA",
      }),
      NOW,
    );

    await createGoal(
      createGoalSchema.parse({
        name: "سفر یگانه",
        kind: "TRAVEL",
        targetAmount: toman(20_000_000),
        owner: "YEGANEH",
      }),
      NOW,
    );

    const reza = (await getHouseholdMonth(SHAHRIVAR, NOW)).members.find(
      member("REZA"),
    )!;

    // 5M opening + 30M in − 4M out.
    expect(reza.accountBalance).toBe("310000000");
    expect(reza.budget).toMatchObject({ amount: "100000000", spent: "40000000" });
    expect(reza.goals).toMatchObject({ count: 1, targetAmount: "450000000" });
  });

  it("says a person has no budget rather than showing an empty one", async () => {
    const reza = (await getHouseholdMonth(SHAHRIVAR, NOW)).members.find(
      member("REZA"),
    )!;

    expect(reza.budget).toBeNull();
  });

  it("is calm and empty for a household that has done nothing", async () => {
    const result = await getHouseholdMonth(SHAHRIVAR, NOW);

    expect(result.household).toEqual({ income: "0", expenses: "0", savings: "0" });
    expect(result.members).toHaveLength(2);
    expect(result.sharedAssets).toBe("0");
    expect(result.sharedLiabilities).toBe("0");
  });
});
