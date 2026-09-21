import { describe, expect, it } from "vitest";

import {
  ONE_QUANTITY,
  QUANTITY_SCALE,
  formatQuantity,
  multiplyByQuantity,
  parseQuantity,
} from "@/utils/quantity";

describe("parseQuantity", () => {
  it("scales a whole number", () => {
    expect(parseQuantity("18")).toBe(18n * QUANTITY_SCALE);
  });

  it("scales a fractional number without going through a float", () => {
    expect(parseQuantity("18.5")).toBe(1_850_000_000n);
    expect(parseQuantity("0.1")).toBe(10_000_000n);
  });

  it("keeps all eight decimal places", () => {
    expect(parseQuantity("0.00000001")).toBe(1n);
    expect(parseQuantity("0.02345678")).toBe(2_345_678n);
  });

  it("accepts Persian digits and the Persian decimal mark", () => {
    expect(parseQuantity("۱۸٫۵")).toBe(1_850_000_000n);
  });

  it("accepts thousands separators", () => {
    expect(parseQuantity("1,200")).toBe(1_200n * QUANTITY_SCALE);
  });

  it("rejects more precision than it can store rather than truncating", () => {
    // Accepting it would store 0.00000001 and show the user a number they
    // did not type.
    expect(parseQuantity("0.000000001")).toBeNull();
  });

  it("rejects a negative quantity", () => {
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("−1")).toBeNull();
  });

  it("rejects text it cannot read rather than returning zero", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity(".")).toBeNull();
    expect(parseQuantity("۱۸ گرم")).toBeNull();
    expect(parseQuantity("1.2.3")).toBeNull();
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros", () => {
    expect(formatQuantity(2n * QUANTITY_SCALE)).toBe("2");
    expect(formatQuantity(1_850_000_000n)).toBe("18.5");
  });

  it("keeps the digits a small holding needs", () => {
    expect(formatQuantity(2_345_678n)).toBe("0.02345678");
  });

  it("groups the integer part", () => {
    expect(formatQuantity(1_200n * QUANTITY_SCALE)).toBe("1,200");
  });

  it("uses Persian digits and separators together", () => {
    expect(formatQuantity(1_850_000_000n, { digits: "persian" })).toBe("۱۸٫۵");
    expect(formatQuantity(1_200n * QUANTITY_SCALE, { digits: "persian" })).toBe(
      "۱٬۲۰۰",
    );
  });

  it("round-trips whatever parseQuantity accepted", () => {
    for (const input of ["18.5", "0.02345678", "1200", "0.00000001", "7"]) {
      expect(formatQuantity(parseQuantity(input)!)).toBe(
        Number(input).toLocaleString("en-US", { maximumFractionDigits: 8 }),
      );
    }
  });
});

describe("multiplyByQuantity", () => {
  it("multiplies a whole holding exactly", () => {
    // 18 grams at 68,400,000 Rial.
    expect(multiplyByQuantity(68_400_000n, 18n * QUANTITY_SCALE)).toBe(1_231_200_000n);
  });

  it("multiplies a fractional holding exactly", () => {
    expect(multiplyByQuantity(68_400_000n, 1_850_000_000n)).toBe(1_265_400_000n);
  });

  it("is identity for a quantity of one", () => {
    expect(multiplyByQuantity(1_400_000_000_000n, ONE_QUANTITY)).toBe(
      1_400_000_000_000n,
    );
  });

  it("rounds half away from zero rather than truncating", () => {
    // 1 Rial per unit × 0.5 units = 0.5 Rial, which does not exist.
    expect(multiplyByQuantity(1n, QUANTITY_SCALE / 2n)).toBe(1n);
    // 0.4 rounds down.
    expect(multiplyByQuantity(1n, (QUANTITY_SCALE / 10n) * 4n)).toBe(0n);
  });

  it("stays exact where a float would not", () => {
    // 2.01 has no exact IEEE-754 representation: 2.01 * 1e12 lands just below
    // the true product, so the float route is a Rial short before it even
    // reaches a rounding decision.
    const price = 1_000_000_000_000n;
    const quantity = parseQuantity("2.01")!;

    expect(multiplyByQuantity(price, quantity)).toBe(2_010_000_000_000n);
    expect(Math.trunc(2.01 * 1e12)).toBe(2_009_999_999_999);
  });

  it("handles a holding large enough to overflow a float's integer range", () => {
    const price = 9_007_199_254_740_993n; // Number.MAX_SAFE_INTEGER + 2
    expect(multiplyByQuantity(price, ONE_QUANTITY)).toBe(price);
  });
});
