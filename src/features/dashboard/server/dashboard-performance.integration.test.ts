import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma, readQueryCount, resetQueryCount } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import { fromJalaliDate } from "@/utils/date";
import {
  getAccountDistribution,
  getCashFlow,
  getDashboardSummary,
  getExpensesByCategory,
  getNetWorthHistory,
} from "@/features/dashboard/server/dashboard-service";

/**
 * Task 2.10: the dashboard aggregates efficiently.
 *
 * "Efficient" is only meaningful if it can fail, so these assert the shape
 * of the work rather than its wall-clock time — which would be flaky and
 * would pass even with an N+1 on a small database.
 *
 * Two properties matter:
 *
 *   The number of round trips is bounded and does not grow with the number
 *   of accounts, categories or months on the chart. That is exactly what an
 *   accidental per-row query would break.
 *
 *   Totals are computed by the database, so the answer does not depend on
 *   pulling the ledger into memory.
 *
 * Requires PRISMA_QUERY_COUNTER=1, which vitest.setup.ts sets.
 */

const MONTH = { year: 1405, month: 6 };

const on = (month: { year: number; month: number }, day: number) =>
  new Date(fromJalaliDate({ ...month, day }).getTime() + 9 * 3_600_000);

async function seed(accountCount: number, transactionsPerMonth: number) {
  await resetLedger();

  const parent = await prisma.category.create({
    data: { name: "خوراک", kind: "EXPENSE" },
  });
  const child = await prisma.category.create({
    data: { name: "خواربار", kind: "EXPENSE", parentId: parent.id },
  });

  const accounts = [];
  for (let index = 0; index < accountCount; index += 1) {
    accounts.push(
      await prisma.account.create({
        data: {
          name: `حساب ${index}`,
          type: "BANK",
          owner: "SHARED",
          initialBalance: 1_000_000n,
        },
      }),
    );
  }

  for (let monthOffset = 0; monthOffset < 6; monthOffset += 1) {
    const month = { year: 1405, month: 1 + monthOffset };

    for (let index = 0; index < transactionsPerMonth; index += 1) {
      const account = accounts[index % accounts.length]!;

      await prisma.transaction.create({
        data: {
          type: index % 2 === 0 ? "INCOME" : "EXPENSE",
          amount: BigInt((index + 1) * 1_000),
          accountId: account.id,
          categoryId: index % 2 === 0 ? null : child.id,
          owner: "SHARED",
          date: on(month, 1 + (index % 20)),
        },
      });
    }
  }

  return accounts;
}

/**
 * Assets and their price history (tasks 3.9, 3.10).
 *
 * Both the count of assets and the count of prices per asset matter: the
 * first is what a naive "latest valuation" lookup would query per row, the
 * second is what a naive "value at this instant" would query per point.
 */
async function seedAssets(assetCount: number, pricesPerAsset: number) {
  await prisma.assetValuation.deleteMany();
  await prisma.asset.deleteMany();

  for (let index = 0; index < assetCount; index += 1) {
    const asset = await prisma.asset.create({
      data: {
        name: `دارایی ${index}`,
        type: "GOLD",
        kind: "QUANTITY",
        owner: "SHARED",
        quantity: 100_000_000n,
        unit: "گرم",
        purchaseUnitPrice: 1_000_000n,
        purchaseDate: on({ year: 1405, month: 1 }, 1),
      },
    });

    for (let price = 0; price < pricesPerAsset; price += 1) {
      const unitPrice = BigInt(1_000_000 + price * 1_000);

      await prisma.assetValuation.create({
        data: {
          assetId: asset.id,
          unitPrice,
          quantity: 100_000_000n,
          value: unitPrice,
          asOf: on({ year: 1405, month: 1 + (price % 6) }, 1 + (price % 20)),
          source: price === 0 ? "INITIAL" : "MANUAL",
        },
      });
    }
  }
}

/**
 * Loans and their instalments (tasks 4.5, 4.9).
 *
 * A ten-year loan is 120 instalments. Both the number of loans and the
 * number of instalments each carries have to be free: the first is what a
 * naive per-loan progress lookup would query, the second is what a naive
 * per-instalment status check would.
 */
async function seedLoans(loanCount: number, installmentsPerLoan: number) {
  await prisma.installment.deleteMany();
  await prisma.loan.deleteMany();

  const account = await prisma.account.findFirst();

  for (let index = 0; index < loanCount; index += 1) {
    const start = on({ year: 1405, month: 1 }, 1);

    await prisma.loan.create({
      data: {
        name: `وام ${index}`,
        provider: "بانک",
        principalAmount: 1_000_000_000n,
        interestRate: 2300,
        installmentAmount: 10_000_000n,
        installmentCount: installmentsPerLoan,
        startDate: start,
        endDate: on({ year: 1409, month: 12 }, 20),
        paymentDay: 5,
        owner: "SHARED",
        accountId: account?.id ?? null,
        installments: {
          create: Array.from({ length: installmentsPerLoan }, (_, number) => ({
            number: number + 1,
            dueDate: new Date(start.getTime() + number * 30 * 86_400_000),
            amount: 10_000_000n,
          })),
        },
      },
    });
  }
}

/** Run something and report how many queries it took. */
async function queriesFor(work: () => Promise<unknown>): Promise<number> {
  resetQueryCount();
  await work();
  return readQueryCount();
}

beforeAll(async () => {
  await seed(3, 8);
});

afterAll(async () => {
  await resetLedger();
  await prisma.$disconnect();
});

describe("query counting", () => {
  it("is actually switched on, or the rest of this file proves nothing", async () => {
    const count = await queriesFor(() => prisma.account.count());
    expect(count).toBeGreaterThan(0);
  });
});

describe("bounded round trips", () => {
  it("builds the whole summary in a handful of queries", async () => {
    const count = await queriesFor(() => getDashboardSummary(MONTH));

    // Two periods, each needing income/expense, a balance, a portfolio
    // valuation and a liability total, plus the upcoming list. The exact
    // number shifts as each sprint's model lands; what must not happen —
    // and what the tests below actually pin — is growth with the data.
    expect(count).toBeLessThanOrEqual(16);
  });

  it("does not issue more queries as the ledger grows", async () => {
    const small = await queriesFor(() => getDashboardSummary(MONTH));

    await seed(8, 40);
    const large = await queriesFor(() => getDashboardSummary(MONTH));

    expect(large).toBe(small);

    await seed(3, 8);
  });

  it("costs the same for six months of cash flow as for twenty-four", async () => {
    const six = await queriesFor(() => getCashFlow(6, MONTH));
    const twentyFour = await queriesFor(() => getCashFlow(24, MONTH));

    expect(twentyFour).toBe(six);
  });

  it("costs the same for every net-worth range", async () => {
    const three = await queriesFor(() => getNetWorthHistory("M3", on(MONTH, 20)));
    const year = await queriesFor(() => getNetWorthHistory("YEAR", on(MONTH, 20)));

    expect(year).toBe(three);
  });

  it("does not query per account for the distribution", async () => {
    const few = await queriesFor(() => getAccountDistribution());

    await seed(8, 8);
    const many = await queriesFor(() => getAccountDistribution());

    expect(many).toBe(few);

    await seed(3, 8);
  });

  it("does not query per asset when valuing the portfolio", async () => {
    await seedAssets(3, 2);
    const few = await queriesFor(() => getDashboardSummary(MONTH));

    await seedAssets(12, 8);
    const many = await queriesFor(() => getDashboardSummary(MONTH));

    expect(many).toBe(few);

    await seedAssets(0, 0);
  });

  it("does not query per point when drawing net worth over assets", async () => {
    await seedAssets(6, 6);

    const three = await queriesFor(() => getNetWorthHistory("M3", on(MONTH, 20)));
    const year = await queriesFor(() => getNetWorthHistory("YEAR", on(MONTH, 20)));

    expect(year).toBe(three);

    await seedAssets(0, 0);
  });

  it("does not query per loan or per instalment for the summary", async () => {
    await seedLoans(2, 12);
    const few = await queriesFor(() => getDashboardSummary(MONTH));

    await seedLoans(8, 120);
    const many = await queriesFor(() => getDashboardSummary(MONTH));

    expect(many).toBe(few);

    await seedLoans(0, 0);
  });

  it("does not query per category for the expense breakdown", async () => {
    const count = await queriesFor(() => getExpensesByCategory(MONTH));

    // One grouped sum, then one lookup for the categories and one for their
    // parents — not one per slice.
    expect(count).toBeLessThanOrEqual(4);
  });

  it("renders the full dashboard payload in a bounded number of queries", async () => {
    const count = await queriesFor(() =>
      Promise.all([
        getDashboardSummary(MONTH),
        getCashFlow(6, MONTH),
        getExpensesByCategory(MONTH),
        getAccountDistribution(),
        getNetWorthHistory("M6", on(MONTH, 20)),
      ]),
    );

    expect(count).toBeLessThanOrEqual(24);
  });
});

describe("the database does the arithmetic", () => {
  it("returns totals, not rows, from the summary", async () => {
    const summary = await getDashboardSummary(MONTH);

    // Nothing in the payload is a transaction list: the widgets receive
    // figures, so the browser never has to add anything up.
    expect(typeof summary.current.monthlyIncome).toBe("string");
    expect(
      Object.values(summary.current).every((value) => typeof value === "string"),
    ).toBe(true);
  });

  it("keeps totals exact at magnitudes a float would round", async () => {
    const account = await prisma.account.findFirstOrThrow();
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount: 9_007_199_254_740_993n,
        accountId: account.id,
        owner: "SHARED",
        date: on(MONTH, 2),
      },
    });

    const summary = await getDashboardSummary(MONTH);
    expect(BigInt(summary.current.monthlyIncome)).toBeGreaterThan(
      9_007_199_254_740_993n,
    );

    await seed(3, 8);
  });
});
