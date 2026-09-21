import { describe, expect, it } from "vitest";

import {
  formatDecimal,
  formatInteger,
  formatPercent,
  parseNumber,
} from "@/utils/number";

describe("formatInteger", () => {
  it("groups with a Latin comma by default", () => {
    expect(formatInteger(125_400_000)).toBe("125,400,000");
  });

  it("uses Persian separators with Persian digits, not a Latin comma", () => {
    expect(formatInteger(1200, { digits: "persian" })).toBe("۱٬۲۰۰");
  });

  it("accepts bigint without going through a float", () => {
    expect(formatInteger(9_007_199_254_740_993n)).toBe("9,007,199,254,740,993");
  });
});

describe("formatDecimal", () => {
  it("fixes the number of decimal places", () => {
    expect(formatDecimal(8.2, { fractionDigits: 1 })).toBe("8.2");
    expect(formatDecimal(8, { fractionDigits: 2 })).toBe("8.00");
  });

  it("uses the Persian decimal mark with Persian digits", () => {
    expect(formatDecimal(8.2, { digits: "persian", fractionDigits: 1 })).toBe("۸٫۲");
  });
});

describe("formatPercent", () => {
  it("formats a ratio, matching the budget progress example", () => {
    // docs/DESIGN_SYSTEM.md / roadmap 5.8: "74%"
    expect(formatPercent(0.74, { fractionDigits: 0 })).toBe("74%");
    expect(formatPercent(0.082, { fractionDigits: 1 })).toBe("8.2%");
  });
});

describe("parseNumber", () => {
  it("parses Latin and Persian input alike", () => {
    expect(parseNumber("1,200")).toBe(1200);
    expect(parseNumber("۱٬۲۰۰")).toBe(1200);
    expect(parseNumber("۸٫۲")).toBe(8.2);
  });

  it("returns null rather than NaN, so a caller cannot forget to check", () => {
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
  });
});
