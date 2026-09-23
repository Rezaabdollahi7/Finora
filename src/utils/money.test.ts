import { describe, expect, it } from "vitest";

import {
  formatRial,
  formatToman,
  parseTomanToRial,
  rialToTomanParts,
  sumRial,
  tomanToRial,
  groupAmountInput,
  caretAfterGrouping,
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

describe("groupAmountInput", () => {
  it("groups the whole part in threes while typing", () => {
    expect(groupAmountInput("1")).toBe("1");
    expect(groupAmountInput("1250")).toBe("1,250");
    expect(groupAmountInput("12500000")).toBe("12,500,000");
  });

  it("regroups text that already has separators in the wrong places", () => {
    expect(groupAmountInput("12,50,0000")).toBe("12,500,000");
    expect(groupAmountInput("1٬250٬000")).toBe("1,250,000");
  });

  it("turns Persian and Arabic digits into Latin ones", () => {
    expect(groupAmountInput("۱۲۵۰۰۰۰")).toBe("1,250,000");
    expect(groupAmountInput("١٢٣٤")).toBe("1,234");
  });

  it("keeps a leading minus and one decimal mark, and nothing else", () => {
    expect(groupAmountInput("-2500000")).toBe("-2,500,000");
    expect(groupAmountInput("−2500")).toBe("-2,500");
    expect(groupAmountInput("1500.5")).toBe("1,500.5");
    expect(groupAmountInput("1500٫5")).toBe("1,500.5");
    expect(groupAmountInput("1.2.3")).toBe("1.23");
    expect(groupAmountInput("12a3 تومان")).toBe("123");
    expect(groupAmountInput("")).toBe("");
  });

  it("stays exact past 2^53, where a number would round", () => {
    expect(groupAmountInput("9007199254740993")).toBe("9,007,199,254,740,993");
  });

  it("produces text the money parser reads back unchanged", () => {
    for (const typed of ["12500000", "-2500000", "1500.5", "۱۲۵۰۰۰۰"]) {
      expect(parseTomanToRial(groupAmountInput(typed))).toBe(parseTomanToRial(typed));
    }
  });
});

describe("caretAfterGrouping", () => {
  it("keeps the caret at the end while typing at the end", () => {
    expect(caretAfterGrouping("1250", 4, "1,250")).toBe(5);
    expect(caretAfterGrouping("125000", 6, "125,000")).toBe(7);
  });

  it("keeps the caret after the same digit when a comma appears in front", () => {
    // Typing "9" after the "1" of "1,250": raw "19,250", caret after the 9.
    expect(caretAfterGrouping("19,250", 2, "19,250")).toBe(2);
    // Raw "1,2950" (typed 9 after the 2), grouped "12,950": after the 9.
    expect(caretAfterGrouping("1,2950", 4, "12,950")).toBe(4);
  });

  it("keeps the caret in place when a digit is deleted", () => {
    // "1,250,000" with the first "0" of "250" deleted: raw "1,25,000".
    expect(caretAfterGrouping("1,25,000", 4, "125,000")).toBe(3);
  });
});
