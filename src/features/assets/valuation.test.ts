import { describe, expect, it } from "vitest";

import { ONE_QUANTITY, parseQuantity } from "@/utils/quantity";
import {
  assetValue,
  portfolioTotals,
  profitAndLoss,
  ratioOf,
} from "@/features/assets/valuation";

/** 18.5 grams. */
const grams = parseQuantity("18.5")!;

describe("assetValue", () => {
  it("multiplies a quantity holding by its unit price (3.5)", () => {
    expect(assetValue({ quantity: grams, unitPrice: 68_400_000n })).toBe(
      1_265_400_000n,
    );
  });

  it("returns a fixed asset's value unchanged, because its quantity is one", () => {
    expect(assetValue({ quantity: ONE_QUANTITY, unitPrice: 14_000_000_000n })).toBe(
      14_000_000_000n,
    );
  });

  it("is zero for a price of zero rather than throwing", () => {
    expect(assetValue({ quantity: grams, unitPrice: 0n })).toBe(0n);
  });

  it("stays exact for a fractional crypto holding", () => {
    // 0.02345678 BTC at 60,000,000,000 Rial each.
    const btc = parseQuantity("0.02345678")!;
    expect(assetValue({ quantity: btc, unitPrice: 60_000_000_000n })).toBe(
      1_407_406_800n,
    );
  });
});

describe("profitAndLoss", () => {
  it("reports a profit when the price rose (3.6)", () => {
    const result = profitAndLoss({
      quantity: grams,
      purchaseUnitPrice: 50_000_000n,
      currentUnitPrice: 68_400_000n,
    });

    expect(result.cost).toBe(925_000_000n);
    expect(result.value).toBe(1_265_400_000n);
    expect(result.profitLoss).toBe(340_400_000n);
    expect(result.returnRatio).toBeCloseTo(0.368, 3);
  });

  it("reports a loss as a negative amount and a negative return", () => {
    const result = profitAndLoss({
      quantity: ONE_QUANTITY,
      purchaseUnitPrice: 14_000_000_000n,
      currentUnitPrice: 11_900_000_000n,
    });

    expect(result.profitLoss).toBe(-2_100_000_000n);
    expect(result.returnRatio).toBeCloseTo(-0.15, 10);
  });

  it("reports no profit and no loss when nothing has been re-priced", () => {
    const result = profitAndLoss({
      quantity: grams,
      purchaseUnitPrice: 68_400_000n,
      currentUnitPrice: 68_400_000n,
    });

    expect(result.profitLoss).toBe(0n);
    expect(result.returnRatio).toBe(0);
  });

  it("has no return ratio when the asset cost nothing", () => {
    // A gift has a real value and a real gain, but no rate of return.
    const result = profitAndLoss({
      quantity: ONE_QUANTITY,
      purchaseUnitPrice: 0n,
      currentUnitPrice: 5_000_000_000n,
    });

    expect(result.profitLoss).toBe(5_000_000_000n);
    expect(result.returnRatio).toBeNull();
  });

  it("stays exact across an amount a float could not hold", () => {
    const result = profitAndLoss({
      quantity: ONE_QUANTITY,
      purchaseUnitPrice: 9_007_199_254_740_993n,
      currentUnitPrice: 9_007_199_254_740_995n,
    });

    // A float would round both operands to the same value and report zero.
    expect(result.profitLoss).toBe(2n);
  });
});

describe("ratioOf", () => {
  it("divides", () => {
    expect(ratioOf(1n, 4n)).toBe(0.25);
  });

  it("is null rather than Infinity or NaN when the whole is zero", () => {
    expect(ratioOf(5n, 0n)).toBeNull();
    expect(ratioOf(0n, 0n)).toBeNull();
  });
});

describe("portfolioTotals", () => {
  it("sums value and cost and derives the portfolio return", () => {
    const totals = portfolioTotals([
      { value: 1_265_400_000n, cost: 925_000_000n },
      { value: 14_000_000_000n, cost: 16_000_000_000n },
    ]);

    expect(totals.value).toBe(15_265_400_000n);
    expect(totals.cost).toBe(16_925_000_000n);
    expect(totals.profitLoss).toBe(-1_659_600_000n);
    expect(totals.returnRatio).toBeCloseTo(-0.098, 3);
  });

  it("is zero for an empty portfolio, with no return to report", () => {
    expect(portfolioTotals([])).toEqual({
      value: 0n,
      cost: 0n,
      profitLoss: 0n,
      returnRatio: null,
    });
  });
});
