import { describe, expect, it } from "vitest";

import {
  formatRial,
  formatToman,
  parseTomanToRial,
  rialToTomanParts,
  sumRial,
  tomanToRial,
} from "@/utils/money";

describe("rial <-> toman conversion", () => {
  it("splits an exact amount into whole Toman", () => {
    expect(rialToTomanParts(1_254_000_000n)).toEqual({
      toman: 125_400_000n,
      rial: 0,
      negative: false,
    });
  });

  it("keeps the sub-Toman remainder instead of rounding it away", () => {
    expect(rialToTomanParts(127n)).toEqual({ toman: 12n, rial: 7, negative: false });
  });

  it("carries the sign on the Toman part and keeps the remainder positive", () => {
    expect(rialToTomanParts(-127n)).toEqual({ toman: -12n, rial: 7, negative: true });
  });

  it("round-trips whole Toman", () => {
    expect(rialToTomanParts(tomanToRial(42_850_000n)).toman).toBe(42_850_000n);
  });
});

describe("formatToman", () => {
  it("formats the design system's reference amount", () => {
    // docs/DESIGN_SYSTEM.md §28
    expect(formatToman(1_254_000_000n)).toBe("125,400,000 تومان");
  });

  it("uses Latin digits by default and Persian on request", () => {
    expect(formatToman(12_000n, { withUnit: false })).toBe("1,200");
    expect(formatToman(12_000n, { withUnit: false, digits: "persian" })).toBe("۱٬۲۰۰");
  });

  it("omits the unit when asked", () => {
    expect(formatToman(10n, { withUnit: false })).toBe("1");
  });

  it("shows a sub-Toman remainder rather than silently dropping it", () => {
    expect(formatToman(127n, { withUnit: false })).toBe("12.7");
  });

  it("renders negatives with a real minus sign", () => {
    expect(formatToman(-50_000n, { withUnit: false })).toBe("−5,000");
  });

  it("can force a leading plus for comparisons", () => {
    expect(formatToman(50_000n, { withUnit: false, signDisplay: "always" })).toBe(
      "+5,000",
    );
    expect(formatToman(0n, { withUnit: false, signDisplay: "always" })).toBe("0");
  });

  it("handles amounts far beyond Number.MAX_SAFE_INTEGER", () => {
    // 9,007,199,254,740,993 Rial is MAX_SAFE_INTEGER + 2: a float would round
    // it to an even number and lose the last Rial.
    const beyondFloat = 9_007_199_254_740_993n;
    expect(formatToman(beyondFloat, { withUnit: false })).toBe("900,719,925,474,099.3");
  });
});

describe("formatRial", () => {
  it("formats with the Rial unit", () => {
    expect(formatRial(1_254_000_000n)).toBe("1,254,000,000 ریال");
  });
});

describe("parseTomanToRial", () => {
  it("parses a plain amount", () => {
    expect(parseTomanToRial("125400000")).toBe(1_254_000_000n);
  });

  it("parses Persian digits", () => {
    expect(parseTomanToRial("۱۲۵۴۰۰")).toBe(1_254_000n);
  });

  it("parses grouped input in either separator style", () => {
    expect(parseTomanToRial("125,400")).toBe(1_254_000n);
    expect(parseTomanToRial("۱۲۵٬۴۰۰")).toBe(1_254_000n);
  });

  it("tolerates whitespace and the directional marks copied text carries", () => {
    expect(parseTomanToRial("  ‎1,200‏ ")).toBe(12_000n);
  });

  it("parses one decimal place as Rial, exactly", () => {
    // 12.3 * 10 is 122.99999999999999 in floating point; this must be 123.
    expect(parseTomanToRial("12.3")).toBe(123n);
    expect(parseTomanToRial("12٫3")).toBe(123n);
  });

  it("rejects precision finer than one Rial", () => {
    expect(parseTomanToRial("12.34")).toBeNull();
  });

  it("parses negatives, including a copied Unicode minus", () => {
    expect(parseTomanToRial("-1,200")).toBe(-12_000n);
    expect(parseTomanToRial("−1,200")).toBe(-12_000n);
  });

  it("returns null for anything unreadable rather than zero", () => {
    for (const input of ["", "   ", "abc", "1.2.3", "12-3", ".", "-", "۱۲a"]) {
      expect(parseTomanToRial(input), `input: ${JSON.stringify(input)}`).toBeNull();
    }
  });

  it("round-trips through formatToman", () => {
    for (const original of ["0", "1", "999", "125,400,000", "12.7"]) {
      const rial = parseTomanToRial(original);
      expect(rial).not.toBeNull();
      expect(parseTomanToRial(formatToman(rial!, { withUnit: false }))).toBe(rial);
    }
  });
});

describe("sumRial", () => {
  it("sums exactly at magnitudes that would break a float", () => {
    const amounts = Array.from({ length: 10 }, () => 1_000_000_000_000_000_001n);
    expect(sumRial(amounts)).toBe(10_000_000_000_000_000_010n);
  });

  it("is zero for an empty list", () => {
    expect(sumRial([])).toBe(0n);
  });
});
