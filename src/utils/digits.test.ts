import { describe, expect, it } from "vitest";

import { hasOnlyLatinDigits, toLatinDigits, toPersianDigits } from "@/utils/digits";

describe("toPersianDigits", () => {
  it("converts digits and leaves everything else alone", () => {
    expect(toPersianDigits("1405/06/30")).toBe("۱۴۰۵/۰۶/۳۰");
    expect(toPersianDigits("۵ روز دیگر")).toBe("۵ روز دیگر");
    expect(toPersianDigits("قسط ۱ از 12")).toBe("قسط ۱ از ۱۲");
  });

  it("accepts numbers and bigints", () => {
    expect(toPersianDigits(42)).toBe("۴۲");
    expect(toPersianDigits(9_007_199_254_740_993n)).toBe("۹۰۰۷۱۹۹۲۵۴۷۴۰۹۹۳");
  });
});

describe("toLatinDigits", () => {
  it("converts Persian digits", () => {
    expect(toLatinDigits("۱۲۵۴۰۰")).toBe("125400");
  });

  it("converts Arabic-Indic digits, which look the same to a user", () => {
    expect(toLatinDigits("١٢٣٤٥٦٧٨٩٠")).toBe("1234567890");
  });

  it("handles the two scripts mixed together", () => {
    expect(toLatinDigits("۱٢۳")).toBe("123");
  });

  it("round-trips", () => {
    expect(toLatinDigits(toPersianDigits("0123456789"))).toBe("0123456789");
  });
});

describe("hasOnlyLatinDigits", () => {
  it("detects non-Latin digits", () => {
    expect(hasOnlyLatinDigits("1,200")).toBe(true);
    expect(hasOnlyLatinDigits("۱٬۲۰۰")).toBe(false);
    expect(hasOnlyLatinDigits("بدون عدد")).toBe(true);
  });
});
