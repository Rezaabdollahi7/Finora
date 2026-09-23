import { beforeEach, describe, expect, it } from "vitest";

import { resetLedger } from "@test/reset";
import { absoluteJalaliMonth, fromJalaliDate, jalaliMonthOf } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import { createCategorySchema } from "@/features/categories/schemas";
import { createCategory } from "@/features/categories/server/category-service";
import { createTransactionSchema } from "@/features/transactions/schemas";
import { createTransaction } from "@/features/transactions/server/transaction-service";
import { createLoanSchema } from "@/features/loans/schemas";
import { createLoan, payInstallment } from "@/features/loans/server/loan-service";
import { payInstallmentSchema } from "@/features/loans/schemas";
import { createAssetSchema } from "@/features/assets/schemas";
import { createAsset } from "@/features/assets/server/asset-service";
import { setBudgetSchema } from "@/features/budgets/schemas";
import { setBudget } from "@/features/budgets/server/budget-service";
import { reportFiltersSchema } from "@/features/reports/schemas";
import { getReports } from "@/features/reports/server/report-service";

/** Tasks 8.1–8.9, against a real PostgreSQL database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const NOW = jalali(1405, 6, 25);
const SHAHRIVAR = absoluteJalaliMonth(jalaliMonthOf(NOW));
const MORDAD = SHAHRIVAR - 1;
const toman = (value: number) => String(value);

const range = (from: number, to: number, extra: Record<string, unknown> = {}) =>
  reportFiltersSchema.parse({ fromMonth: from, toMonth: to, ...extra });

let bank: Awaited<ReturnType<typeof createAccount>>;
let wallet: Awaited<ReturnType<typeof createAccount>>;
let food: Awaited<ReturnType<typeof createCategory>>;
let groceries: Awaited<ReturnType<typeof createCategory>>;
let housing: Awaited<ReturnType<typeof createCategory>>;
let salary: Awaited<ReturnType<typeof createCategory>>;

beforeEach(async () => {
  await resetLedger();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      initialBalance: toman(10_000_000),
    }),
  );
  wallet = await createAccount(
    createAccountSchema.parse({
      name: "کیف پول رضا",
      type: "WALLET",
      owner: "REZA",
      initialBalance: toman(1_000_000),
    }),
  );

  food = await createCategory(
    createCategorySchema.parse({ name: "خوراک", kind: "EXPENSE" }),
  );
  groceries = await createCategory(
    createCategorySchema.parse({
      name: "خواربار",
      kind: "EXPENSE",
      parentId: food.id,
    }),
  );
  housing = await createCategory(
    createCategorySchema.parse({ name: "مسکن", kind: "EXPENSE" }),
  );
  salary = await createCategory(
    createCategorySchema.parse({ name: "حقوق", kind: "INCOME" }),
  );
});

const earn = (amount: string, when: Date, owner = "SHARED", into = bank) =>
  createTransaction(
    createTransactionSchema.parse({
      type: "INCOME",
      amount,
      date: when.toISOString(),
      accountId: into.id,
      categoryId: salary.id,
      owner,
    }),
  );

const spend = (
  amount: string,
  when: Date,
  category: { id: string },
  owner = "SHARED",
  from = bank,
) =>
  createTransaction(
    createTransactionSchema.parse({
      type: "EXPENSE",
      amount,
      date: when.toISOString(),
      accountId: from.id,
      categoryId: category.id,
      owner,
    }),
  );

describe("the monthly report", () => {
  it("reports income, spending, savings and the rate", async () => {
    await earn(toman(80_000_000), jalali(1405, 6, 3));
    await spend(toman(20_000_000), jalali(1405, 6, 10), housing);

    const { monthly } = await getReports(range(SHAHRIVAR, SHAHRIVAR), NOW);

    expect(monthly.income).toBe("800000000");
    expect(monthly.expenses).toBe("200000000");
    expect(monthly.savings).toBe("600000000");
    expect(monthly.savingsRate).toBeCloseTo(0.75, 5);
  });

  it("counts an instalment actually paid as a debt payment", async () => {
    const loan = await createLoan(
      createLoanSchema.parse({
        name: "وام خودرو",
        provider: "بانک ملت",
        principalAmount: toman(100_000_000),
        installmentAmount: toman(5_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 5, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    // Due in Mordad, paid late in Shahrivar. The report is about money that
    // left, so it belongs to Shahrivar — and asserting it against a month
    // where the due and paid dates agree would prove nothing.
    await payInstallment(
      loan.id,
      1,
      payInstallmentSchema.parse({ paidAt: jalali(1405, 6, 20).toISOString() }),
      NOW,
    );

    const series = (await getReports(range(MORDAD, SHAHRIVAR), NOW)).series;

    expect(series.find((p) => p.month === MORDAD)!.debtPayments).toBe("0");
    expect(series.find((p) => p.month === SHAHRIVAR)!.debtPayments).toBe("50000000");
  });

  it("does not count an instalment that is merely due", async () => {
    await createLoan(
      createLoanSchema.parse({
        name: "وام معوق",
        provider: "بانک ملت",
        principalAmount: toman(50_000_000),
        installmentAmount: toman(4_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 5, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    const { monthly } = await getReports(range(SHAHRIVAR, SHAHRIVAR), NOW);

    expect(monthly.debtPayments).toBe("0");
  });

  it("counts an asset bought this month as an investment, at cost", async () => {
    await createAsset(
      createAssetSchema.parse({
        name: "سکه",
        type: "GOLD",
        owner: "SHARED",
        quantity: "2",
        purchaseUnitPrice: toman(30_000_000),
        purchaseDate: jalali(1405, 6, 5).toISOString(),
      }),
    );

    const { monthly } = await getReports(range(SHAHRIVAR, SHAHRIVAR), NOW);

    // At what it cost, not at what it is worth now.
    expect(monthly.investments).toBe("600000000");
  });

  it("has no savings rate for a month that earned nothing", async () => {
    await spend(toman(5_000_000), jalali(1405, 6, 10), housing);

    const { monthly } = await getReports(range(SHAHRIVAR, SHAHRIVAR), NOW);

    expect(monthly.savingsRate).toBeNull();
    expect(monthly.savings).toBe("-50000000");
  });
});

describe("the income and expense reports", () => {
  beforeEach(async () => {
    await earn(toman(60_000_000), jalali(1405, 5, 3));
    await earn(toman(65_000_000), jalali(1405, 6, 3));
    await earn(toman(4_000_000), jalali(1405, 6, 6), "REZA", wallet);

    await spend(toman(30_000_000), jalali(1405, 5, 8), housing);
    await spend(toman(8_000_000), jalali(1405, 6, 9), groceries);
    await spend(toman(2_000_000), jalali(1405, 6, 12), food);
    await spend(toman(1_500_000), jalali(1405, 6, 14), housing, "REZA", wallet);
  });

  it("breaks income down by month, owner and account", async () => {
    const { income } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(income.total).toBe("1290000000");
    expect(income.byMonth.map((m) => m.amount)).toEqual(["600000000", "690000000"]);
    expect(income.byOwner.find((b) => b.key === "REZA")!.amount).toBe("40000000");
    expect(income.byAccount.find((b) => b.key === bank.id)!.amount).toBe("1250000000");
  });

  it("rolls a child category up into its parent", async () => {
    const { expenses } = await getReports(range(MORDAD, SHAHRIVAR), NOW);
    const line = expenses.byCategory.find((b) => b.key === food.id)!;

    // 8M of groceries plus 2M filed on the parent itself.
    expect(line.amount).toBe("100000000");
    expect(expenses.byCategory.some((b) => b.key === groceries.id)).toBe(false);
  });

  it("orders a breakdown largest first, and its shares add to one", async () => {
    const { expenses } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(expenses.byCategory[0]!.key).toBe(housing.id);
    const total = expenses.byCategory.reduce((sum, b) => sum + b.share, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  it("never counts a transfer as income or spending", async () => {
    const before = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    await createTransaction(
      createTransactionSchema.parse({
        type: "TRANSFER",
        amount: toman(50_000_000),
        date: jalali(1405, 6, 15).toISOString(),
        accountId: bank.id,
        toAccountId: wallet.id,
        owner: "SHARED",
      }),
    );

    const after = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(after.income.total).toBe(before.income.total);
    expect(after.expenses.total).toBe(before.expenses.total);
    // The monthly series is built by a separate pass, and asserting only on
    // the breakdowns left its own transfer guard untested.
    expect(after.monthly.expenses).toBe(before.monthly.expenses);
    expect(after.monthly.income).toBe(before.monthly.income);
    expect(after.savings.savings).toBe(before.savings.savings);
  });
});

describe("filters", () => {
  beforeEach(async () => {
    await earn(toman(60_000_000), jalali(1405, 6, 3));
    await earn(toman(4_000_000), jalali(1405, 6, 6), "REZA", wallet);
    await spend(toman(8_000_000), jalali(1405, 6, 9), groceries);
    await spend(toman(1_500_000), jalali(1405, 6, 14), housing, "REZA", wallet);
  });

  it("narrows to one owner", async () => {
    const { income, expenses } = await getReports(
      range(SHAHRIVAR, SHAHRIVAR, { owner: "REZA" }),
      NOW,
    );

    expect(income.total).toBe("40000000");
    expect(expenses.total).toBe("15000000");
  });

  it("narrows to one account", async () => {
    const { expenses } = await getReports(
      range(SHAHRIVAR, SHAHRIVAR, { accountId: wallet.id }),
      NOW,
    );

    expect(expenses.total).toBe("15000000");
  });

  it("keeps a category's children when filtering by the parent", async () => {
    // Filtering by "food" must not silently drop the groceries inside it.
    const { expenses } = await getReports(
      range(SHAHRIVAR, SHAHRIVAR, { categoryId: food.id }),
      NOW,
    );

    expect(expenses.total).toBe("80000000");
  });

  it("refuses a range that runs backwards", () => {
    expect(() =>
      reportFiltersSchema.parse({ fromMonth: SHAHRIVAR, toMonth: MORDAD }),
    ).toThrow();
  });

  it("refuses a range longer than it will draw", () => {
    expect(() =>
      reportFiltersSchema.parse({ fromMonth: SHAHRIVAR - 30, toMonth: SHAHRIVAR }),
    ).toThrow();
  });
});

describe("the debt report", () => {
  it("separates what was borrowed, paid and still owed", async () => {
    const loan = await createLoan(
      createLoanSchema.parse({
        name: "وام خودرو",
        provider: "بانک ملت",
        principalAmount: toman(100_000_000),
        installmentAmount: toman(5_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 5, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    await payInstallment(
      loan.id,
      1,
      payInstallmentSchema.parse({ paidAt: jalali(1405, 5, 10).toISOString() }),
      NOW,
    );

    const { debt } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    // Borrowed is the principal; repaid is 12 × 5M, which includes interest.
    expect(debt.originalDebt).toBe("1000000000");
    expect(debt.paidDebt).toBe("50000000");
    expect(debt.remainingDebt).toBe("550000000");
    expect(debt.monthlyBurden).toBe("50000000");
    expect(debt.upcoming[0]).toMatchObject({ number: 2, amount: "50000000" });
  });

  it("leaves a settled loan out of the monthly burden", async () => {
    // A loan that is finished costs nothing a month, and counting it would
    // make the burden grow every time the household paid one off.
    const settled = await createLoan(
      createLoanSchema.parse({
        name: "وام تمام‌شده",
        provider: "بانک ملت",
        principalAmount: toman(6_000_000),
        installmentAmount: toman(3_000_000),
        installmentCount: 2,
        startDate: jalali(1405, 4, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    for (const number of [1, 2]) {
      await payInstallment(
        settled.id,
        number,
        payInstallmentSchema.parse({ paidAt: jalali(1405, 5, 10).toISOString() }),
        NOW,
      );
    }

    await createLoan(
      createLoanSchema.parse({
        name: "وام جاری",
        provider: "بانک ملت",
        principalAmount: toman(100_000_000),
        installmentAmount: toman(5_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 5, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    const { debt } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(debt.monthlyBurden).toBe("50000000");
    // The settled loan is still part of what was borrowed and paid.
    expect(debt.originalDebt).toBe("1060000000");
  });

  it("is empty and calm for a household with no loans", async () => {
    const { debt } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(debt).toMatchObject({
      originalDebt: "0",
      remainingDebt: "0",
      monthlyBurden: "0",
      upcoming: [],
    });
  });
});

describe("the asset report", () => {
  it("reports value, cost, profit and allocation", async () => {
    await createAsset(
      createAssetSchema.parse({
        name: "سکه",
        type: "GOLD",
        owner: "SHARED",
        quantity: "2",
        purchaseUnitPrice: toman(30_000_000),
        purchaseDate: jalali(1405, 4, 1).toISOString(),
      }),
    );

    const { assets } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(assets.totalCost).toBe("600000000");
    expect(assets.totalValue).toBe("600000000");
    expect(assets.profitAndLoss).toBe("0");
    expect(assets.allocation[0]).toMatchObject({ key: "GOLD", share: 1 });
    expect(assets.largest[0]).toMatchObject({ name: "سکه", share: 1 });
  });

  it("values each month at what the holdings were worth then", async () => {
    await createAsset(
      createAssetSchema.parse({
        name: "سکه",
        type: "GOLD",
        owner: "SHARED",
        quantity: "1",
        purchaseUnitPrice: toman(30_000_000),
        purchaseDate: jalali(1405, 5, 1).toISOString(),
      }),
    );

    const { assets } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    // Rule G.4: the line is history, not today's price applied backwards.
    expect(assets.history).toHaveLength(2);
    expect(assets.history[0]!.value).toBe("300000000");
  });
});

describe("category observations", () => {
  it("reports the largest categories with a share and a direction", async () => {
    await spend(toman(10_000_000), jalali(1405, 5, 8), housing);
    await spend(toman(20_000_000), jalali(1405, 6, 8), housing);
    await spend(toman(3_000_000), jalali(1405, 6, 9), groceries);

    const { categories } = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(categories[0]!.categoryName).toBe("مسکن");
    expect(categories[0]!.amount).toBe("300000000");
    expect(categories[0]!.trend).toBe("UP");
    expect(categories[0]!.previous).toBe("100000000");
  });

  it("calls a small month-on-month move flat", async () => {
    await spend(toman(10_000_000), jalali(1405, 5, 8), housing);
    await spend(toman(10_200_000), jalali(1405, 6, 8), housing);

    expect((await getReports(range(MORDAD, SHAHRIVAR), NOW)).categories[0]!.trend).toBe(
      "FLAT",
    );
  });

  it("names the budget in force, so budget and actual sit side by side", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(25_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );
    await spend(toman(30_000_000), jalali(1405, 6, 8), housing);

    const { categories } = await getReports(range(SHAHRIVAR, SHAHRIVAR), NOW);

    expect(categories[0]!.budget).toBe("250000000");
  });

  it("carries no score, only figures and a direction", async () => {
    await spend(toman(10_000_000), jalali(1405, 6, 8), housing);

    const [observation] = (await getReports(range(SHAHRIVAR, SHAHRIVAR), NOW))
      .categories;

    // Task 8.8: factual observations, never a subjective rating.
    expect(Object.keys(observation!).sort()).toEqual([
      "amount",
      "budget",
      "categoryId",
      "categoryName",
      "previous",
      "share",
      "trend",
    ]);
  });
});

describe("an empty household", () => {
  it("returns a full, zeroed report rather than throwing", async () => {
    const reports = await getReports(range(MORDAD, SHAHRIVAR), NOW);

    expect(reports.monthly.income).toBe("0");
    expect(reports.income.byCategory).toEqual([]);
    expect(reports.categories).toEqual([]);
    expect(reports.series).toHaveLength(2);
    expect(reports.netWorth.netWorth.current).toBe("110000000");
  });
});
