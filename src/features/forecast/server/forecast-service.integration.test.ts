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
import { createLoan } from "@/features/loans/server/loan-service";
import {
  createRecurringPaymentSchema,
  payOccurrenceSchema,
} from "@/features/recurring/schemas";
import {
  createRecurringPayment,
  payOccurrence,
} from "@/features/recurring/server/recurring-service";
import { setBudgetSchema } from "@/features/budgets/schemas";
import { setBudget } from "@/features/budgets/server/budget-service";
import { getForecast } from "@/features/forecast/server/forecast-service";

/** Tasks 6.6–6.9, against a real PostgreSQL database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

/** A moment early in Shahrivar 1405, so the whole month is still ahead. */
const NOW = jalali(1405, 6, 2);
const SHAHRIVAR = absoluteJalaliMonth(jalaliMonthOf(NOW));

const toman = (value: number) => String(value);

let bank: Awaited<ReturnType<typeof createAccount>>;
let housing: Awaited<ReturnType<typeof createCategory>>;
let rent: Awaited<ReturnType<typeof createCategory>>;

beforeEach(async () => {
  await resetLedger();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      initialBalance: toman(30_000_000),
    }),
  );

  housing = await createCategory(
    createCategorySchema.parse({ name: "مسکن", kind: "EXPENSE" }),
  );

  rent = await createCategory(
    createCategorySchema.parse({
      name: "اجاره",
      kind: "EXPENSE",
      parentId: housing.id,
    }),
  );
});

async function earn(amount: string, when: Date) {
  return createTransaction(
    createTransactionSchema.parse({
      type: "INCOME",
      amount,
      date: when.toISOString(),
      accountId: bank.id,
      owner: "SHARED",
    }),
  );
}

describe("what the forecast starts from", () => {
  it("counts only the balances that can actually be spent", async () => {
    await createAccount(
      createAccountSchema.parse({
        name: "سبد بورس",
        type: "INVESTMENT",
        owner: "REZA",
        initialBalance: toman(500_000_000),
      }),
    );

    // Counting the investment account would turn a real shortfall into a
    // comfortable balance, which is what this whole feature exists to stop.
    expect((await getForecast(1, NOW)).openingBalance).toBe("300000000");
  });

  it("takes the median of past income, not the mean", async () => {
    for (const [monthsAgo, amount] of [
      [1, "60,000,000"],
      [2, "62,000,000"],
      [3, "200,000,000"],
      [4, "61,000,000"],
      [5, "59,000,000"],
    ] as const) {
      await earn(amount, jalali(1405, 6 - monthsAgo, 10));
    }

    const result = await getForecast(1, NOW);

    expect(result.incomeMonths).toBe(5);
    expect(result.expectedIncome).toBe("610000000");
  });

  it("ignores the month in progress, which is only part-earned", async () => {
    await earn("60,000,000", jalali(1405, 5, 10));
    // A single day's income this month must not become a month's worth.
    await earn("2,000,000", jalali(1405, 6, 1));

    expect((await getForecast(1, NOW)).expectedIncome).toBe("600000000");
  });

  it("expects nothing from a household with no recorded income", async () => {
    const result = await getForecast(1, NOW);

    expect(result.expectedIncome).toBe("0");
    expect(result.incomeMonths).toBe(0);
  });
});

describe("what it subtracts", () => {
  it("subtracts the instalments falling due in each month", async () => {
    await createLoan(
      createLoanSchema.parse({
        name: "وام مسکن",
        provider: "بانک مسکن",
        principalAmount: toman(100_000_000),
        installmentAmount: toman(5_000_000),
        installmentCount: 12,
        startDate: jalali(1405, 6, 1).toISOString(),
        paymentDay: 10,
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    const [first, second] = (await getForecast(3, NOW)).points;

    expect(first!.loanPayments).toBe("50000000");
    expect(second!.loanPayments).toBe("50000000");
  });

  it("subtracts the recurring payments falling due", async () => {
    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اینترنت",
        amount: toman(850_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 20,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    expect((await getForecast(1, NOW)).points[0]!.recurringExpenses).toBe("8500000");
  });

  it("subtracts a budget as the discretionary spending it stands for", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(50_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    expect((await getForecast(1, NOW)).points[0]!.budgetedExpenses).toBe("500000000");
  });
});

describe("budgets and recurring payments overlap", () => {
  it("does not charge the household twice for its rent", async () => {
    // The rent is a recurring payment AND sits inside a budgeted category.
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(50_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(45_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 5,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        categoryId: rent.id,
        accountId: bank.id,
      }),
      NOW,
    );

    const point = (await getForecast(1, NOW)).points[0]!;

    expect(point.recurringExpenses).toBe("450000000");
    // 50M budget less the 45M the rule already covers: 5M of groceries-level
    // discretionary housing spending, not another 50M on top.
    expect(point.budgetedExpenses).toBe("50000000");
    expect(point.outflow).toBe("500000000");
  });

  it("floors a budget at zero when the recurring payments exceed it", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(10_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(45_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 5,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        categoryId: rent.id,
        accountId: bank.id,
      }),
      NOW,
    );

    const point = (await getForecast(1, NOW)).points[0]!;

    // An under-set budget does not become a credit against the rent.
    expect(point.budgetedExpenses).toBe("0");
    expect(point.outflow).toBe("450000000");
  });

  it("counts a budgeted child once, not once per budgeted ancestor", async () => {
    for (const [categoryId, amount] of [
      [housing.id, toman(50_000_000)],
      [rent.id, toman(45_000_000)],
    ] as const) {
      await setBudget(
        setBudgetSchema.parse({ categoryId, amount, fromMonth: SHAHRIVAR }),
      );
    }

    // The child's limit already sits inside the parent's.
    expect((await getForecast(1, NOW)).points[0]!.budgetedExpenses).toBe("500000000");
  });

  it("still counts a recurring payment with no category at all", async () => {
    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "بی‌دسته",
        amount: toman(3_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 5,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    // It cannot be netted against any budget, but it is still money going out.
    expect((await getForecast(1, NOW)).points[0]!.recurringExpenses).toBe("30000000");
  });
});

describe("the projection", () => {
  it("carries each month's closing balance into the next month's opening", async () => {
    await earn("60,000,000", jalali(1405, 5, 10));

    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(45_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 5,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    const points = (await getForecast(3, NOW)).points;

    // The opening balance is 90M, not the account's 30M starting figure:
    // last month's salary was paid into the account and is sitting in it.
    // Then 60M in and 45M out each month.
    expect(points[0]!.openingBalance).toBe("900000000");
    expect(points.map((point) => point.closingBalance)).toEqual([
      "1050000000",
      "1200000000",
      "1350000000",
    ]);
    expect(points[1]!.openingBalance).toBe(points[0]!.closingBalance);
  });

  it("names the first month the household runs out", async () => {
    await earn("10,000,000", jalali(1405, 5, 10));

    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(25_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 5,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    const result = await getForecast(6, NOW);

    // 40M in the account once last month's income is counted, losing 15M a
    // month: 25, 10, then under.
    expect(result.points[0]!.openingBalance).toBe("400000000");
    expect(result.shortfallMonth).toBe(SHAHRIVAR + 2);
    expect(result.points.map((point) => point.isShortfall)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
    ]);
  });

  it("gives one point per month for each period the roadmap asks for", async () => {
    for (const period of [1, 3, 6, 12] as const) {
      expect((await getForecast(period, NOW)).points).toHaveLength(period);
    }
  });
});

describe("the week ahead", () => {
  it("warns when the payments due this week exceed what is spendable", async () => {
    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(47_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 5,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    const { warning } = await getForecast(1, NOW);

    expect(warning).toEqual({
      availableBalance: "300000000",
      expectedPayments: "470000000",
      shortfall: "170000000",
      days: 7,
    });
  });

  it("says nothing about a payment that falls after the window", async () => {
    await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(47_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 25,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        accountId: bank.id,
      }),
      NOW,
    );

    // The month is not covered, but the week is — and those are different
    // questions, which is why this warning is not a slice of the forecast.
    const result = await getForecast(1, NOW);

    expect(result.warning).toBeNull();
    expect(result.points[0]!.isShortfall).toBe(true);
  });

  it("says nothing when the week is covered", async () => {
    expect((await getForecast(1, NOW)).warning).toBeNull();
  });
});

describe("the month in progress", () => {
  it("does not count income the household has already been paid", async () => {
    // Last month's salary sets the estimate; this month's is already in the
    // balance, so counting a whole month's income on top would count it twice.
    await earn("60,000,000", jalali(1405, 5, 10));
    await earn("60,000,000", jalali(1405, 6, 1));

    const result = await getForecast(3, NOW);

    expect(result.expectedIncome).toBe("600000000");
    expect(result.points[0]!.income).toBe("0");
    // Next month has been paid nothing yet, so it expects the full estimate.
    expect(result.points[1]!.income).toBe("600000000");
  });

  it("counts only the part of this month's income still to come", async () => {
    await earn("60,000,000", jalali(1405, 5, 10));
    await earn("20,000,000", jalali(1405, 6, 1));

    expect((await getForecast(1, NOW)).points[0]!.income).toBe("400000000");
  });

  it("never turns an unusually good month into negative income", async () => {
    await earn("60,000,000", jalali(1405, 5, 10));
    await earn("200,000,000", jalali(1405, 6, 1));

    expect((await getForecast(1, NOW)).points[0]!.income).toBe("0");
  });

  it("does not count budgeted spending that has already happened", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(50_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await createTransaction(
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: toman(20_000_000),
        date: jalali(1405, 6, 1).toISOString(),
        accountId: bank.id,
        categoryId: rent.id,
        owner: "SHARED",
      }),
    );

    const result = await getForecast(3, NOW);

    // 50M budget less the 20M already spent on it; next month starts fresh.
    expect(result.points[0]!.budgetedExpenses).toBe("300000000");
    expect(result.points[1]!.budgetedExpenses).toBe("500000000");
  });

  it("floors an over-spent budget at zero rather than crediting it", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(10_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    await createTransaction(
      createTransactionSchema.parse({
        type: "EXPENSE",
        amount: toman(30_000_000),
        date: jalali(1405, 6, 1).toISOString(),
        accountId: bank.id,
        categoryId: housing.id,
        owner: "SHARED",
      }),
    );

    expect((await getForecast(1, NOW)).points[0]!.budgetedExpenses).toBe("0");
  });

  it("does not subtract a recurring payment twice once it has been paid", async () => {
    await setBudget(
      setBudgetSchema.parse({
        categoryId: housing.id,
        amount: toman(50_000_000),
        fromMonth: SHAHRIVAR,
      }),
    );

    const { id } = await createRecurringPayment(
      createRecurringPaymentSchema.parse({
        name: "اجاره خانه",
        amount: toman(20_000_000),
        frequency: "MONTHLY",
        interval: 1,
        paymentDay: 1,
        startDate: jalali(1405, 6, 1).toISOString(),
        owner: "SHARED",
        categoryId: rent.id,
        accountId: bank.id,
      }),
      NOW,
    );

    // Paying it turns the projected occurrence into a real expense. It must
    // be netted off the budget once, not once as an occurrence and again as
    // spending.
    await payOccurrence(
      id,
      payOccurrenceSchema.parse({ dueDate: jalali(1405, 6, 1).toISOString() }),
      NOW,
    );

    const point = (await getForecast(1, NOW)).points[0]!;

    expect(point.recurringExpenses).toBe("0");
    expect(point.budgetedExpenses).toBe("300000000");
  });
});
