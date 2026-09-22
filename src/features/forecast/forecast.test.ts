import { describe, expect, it } from "vitest";

import {
  expectedIncome,
  firstShortfall,
  forecast,
  isLiquid,
  liquidityWarning,
  LIQUID_ACCOUNT_TYPES,
  type ForecastMonthInput,
} from "@/features/forecast/forecast";

const toman = (value: number) => BigInt(value) * 10n;

const month = (
  index: number,
  overrides: Partial<Omit<ForecastMonthInput, "month">> = {},
): ForecastMonthInput => ({
  month: 16865 + index,
  income: toman(60_000_000),
  loanPayments: toman(12_000_000),
  recurringExpenses: toman(20_000_000),
  budgetedExpenses: toman(18_000_000),
  ...overrides,
});

describe("forecast", () => {
  it("adds income and subtracts every kind of outgoing", () => {
    const [first] = forecast(toman(30_000_000), [month(0)]);

    // 12 + 20 + 18 out, 60 in.
    expect(first!.outflow).toBe(toman(50_000_000));
    expect(first!.net).toBe(toman(10_000_000));
    expect(first!.closingBalance).toBe(toman(40_000_000));
    expect(first!.isShortfall).toBe(false);
  });

  it("carries each month's closing balance into the next month's opening", () => {
    const points = forecast(toman(30_000_000), [month(0), month(1), month(2)]);

    expect(points.map((point) => point.openingBalance)).toEqual([
      toman(30_000_000),
      toman(40_000_000),
      toman(50_000_000),
    ]);
    expect(points.at(-1)!.closingBalance).toBe(toman(60_000_000));
  });

  it("lets a run of small losses add up to a shortfall months later", () => {
    // Each month loses 5M; from 12M that survives two months and not the third.
    const lossy = (index: number) => month(index, { income: toman(45_000_000) });
    const points = forecast(toman(12_000_000), [lossy(0), lossy(1), lossy(2)]);

    expect(points.map((point) => point.closingBalance)).toEqual([
      toman(7_000_000),
      toman(2_000_000),
      toman(-3_000_000),
    ]);
    expect(points.map((point) => point.isShortfall)).toEqual([false, false, true]);
  });

  it("names the first month that runs out, not the worst one", () => {
    const lossy = (index: number) => month(index, { income: toman(45_000_000) });
    const points = forecast(toman(12_000_000), [
      lossy(0),
      lossy(1),
      lossy(2),
      lossy(3),
    ]);

    expect(firstShortfall(points)!.month).toBe(16867);
  });

  it("reports no shortfall when there is none", () => {
    expect(
      firstShortfall(forecast(toman(30_000_000), [month(0), month(1)])),
    ).toBeNull();
  });

  it("starts in the red and stays there when the opening balance is negative", () => {
    // An overdrawn account is not a reason to hide the rest of the forecast.
    const [first] = forecast(toman(-5_000_000), [month(0)]);

    expect(first!.openingBalance).toBe(toman(-5_000_000));
    expect(first!.closingBalance).toBe(toman(5_000_000));
    expect(first!.isShortfall).toBe(false);
  });

  it("keeps whole Rial past 2^53, where a double would round", () => {
    const [point] = forecast(9_007_199_254_740_993n, [
      {
        month: 0,
        income: 1n,
        loanPayments: 0n,
        recurringExpenses: 0n,
        budgetedExpenses: 0n,
      },
    ]);

    expect(point!.closingBalance).toBe(9_007_199_254_740_994n);
  });

  it("returns nothing for no months rather than throwing", () => {
    expect(forecast(toman(30_000_000), [])).toEqual([]);
  });
});

describe("expectedIncome", () => {
  it("takes the median, so one bonus month does not inflate every future one", () => {
    const months = [
      toman(60_000_000),
      toman(62_000_000),
      toman(200_000_000), // a bonus
      toman(61_000_000),
      toman(59_000_000),
    ];

    expect(expectedIncome(months)).toBe(toman(61_000_000));
    // The mean would have promised the household 17M a month it will not see.
    const mean = months.reduce((sum, value) => sum + value, 0n) / 5n;
    expect(mean).toBeGreaterThan(toman(78_000_000));
  });

  it("errs low on an even count rather than inventing half a Rial", () => {
    expect(expectedIncome([toman(50_000_000), toman(70_000_000)])).toBe(
      toman(50_000_000),
    );
  });

  it("is nothing for a household with no recorded income yet", () => {
    expect(expectedIncome([])).toBe(0n);
  });

  it("does not mutate the array it was handed", () => {
    const months = [toman(70_000_000), toman(50_000_000)];
    expectedIncome(months);

    expect(months).toEqual([toman(70_000_000), toman(50_000_000)]);
  });
});

describe("liquidityWarning", () => {
  it("warns with the roadmap's own three figures", () => {
    expect(liquidityWarning(toman(12_000_000), toman(17_000_000), 7)).toEqual({
      availableBalance: String(toman(12_000_000)),
      expectedPayments: String(toman(17_000_000)),
      shortfall: String(toman(5_000_000)),
      days: 7,
    });
  });

  it("says nothing when the balance covers the payments exactly", () => {
    expect(liquidityWarning(toman(17_000_000), toman(17_000_000), 7)).toBeNull();
  });

  it("says nothing when there is room to spare", () => {
    expect(liquidityWarning(toman(20_000_000), toman(17_000_000), 7)).toBeNull();
  });
});

describe("what counts as liquid", () => {
  it("counts the accounts money can actually be spent from", () => {
    expect(LIQUID_ACCOUNT_TYPES.every(isLiquid)).toBe(true);
    expect([...LIQUID_ACCOUNT_TYPES]).toEqual(["BANK", "CASH", "WALLET"]);
  });

  it("leaves out what would have to be liquidated or is not the household's", () => {
    // Counting either would turn a real shortfall into a comfortable balance.
    expect(isLiquid("INVESTMENT")).toBe(false);
    expect(isLiquid("BUSINESS")).toBe(false);
  });
});
