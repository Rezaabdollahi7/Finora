import { describe, expect, it } from "vitest";

import { ONE_QUANTITY } from "@/utils/quantity";
import {
  assetFiltersSchema,
  createAssetSchema,
  recordValuationSchema,
  updateAssetSchema,
} from "@/features/assets/schemas";

/**
 * Task 3.11, input side.
 *
 * The schemas are the only gate between what a person types and the
 * database, so what they reject matters as much as what they accept. These
 * run without a database, which is the point: a rule that only fails at the
 * CHECK constraint is a rule the user meets as a 500.
 */

const valid = {
  name: "طلای آب‌شده",
  type: "GOLD",
  owner: "SHARED",
  quantity: "18.5",
  purchaseUnitPrice: "6,840,000",
  purchaseDate: "2026-03-20T00:00:00.000Z",
};

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

describe("createAssetSchema", () => {
  it("converts Toman to Rial and the quantity to its scaled integer", () => {
    const parsed = createAssetSchema.parse(valid);

    expect(parsed.purchaseUnitPrice).toBe(68_400_000n);
    expect(parsed.quantity).toBe(1_850_000_000n);
    expect(parsed.purchaseDate).toBeInstanceOf(Date);
  });

  it("accepts Persian digits in both the amount and the quantity", () => {
    const parsed = createAssetSchema.parse({
      ...valid,
      quantity: "۱۸٫۵",
      purchaseUnitPrice: "۶٬۸۴۰٬۰۰۰",
    });

    expect(parsed.quantity).toBe(1_850_000_000n);
    expect(parsed.purchaseUnitPrice).toBe(68_400_000n);
  });

  it("defaults a missing quantity to exactly one, for a fixed-value asset", () => {
    const parsed = createAssetSchema.parse({
      name: "پژو ۲۰۷",
      type: "CAR",
      owner: "REZA",
      purchaseUnitPrice: "1,400,000,000",
      purchaseDate: valid.purchaseDate,
    });

    expect(parsed.quantity).toBe(ONE_QUANTITY);
    expect(parsed.unit).toBeNull();
    expect(parsed.notes).toBeNull();
    expect(parsed.currentUnitPrice).toBeUndefined();
  });

  it("rejects a holding of nothing", () => {
    const result = createAssetSchema.safeParse({ ...valid, quantity: "0" });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain("مقدار باید بزرگ‌تر از صفر باشد.");
  });

  it("rejects a negative holding and a negative price", () => {
    expect(createAssetSchema.safeParse({ ...valid, quantity: "-3" }).success).toBe(
      false,
    );
    expect(
      createAssetSchema.safeParse({ ...valid, purchaseUnitPrice: "-1000" }).success,
    ).toBe(false);
  });

  it("accepts a price of zero, for something that was a gift", () => {
    expect(
      createAssetSchema.parse({ ...valid, purchaseUnitPrice: "0" }).purchaseUnitPrice,
    ).toBe(0n);
  });

  it("rejects an amount it cannot read rather than treating it as zero", () => {
    const result = createAssetSchema.safeParse({
      ...valid,
      purchaseUnitPrice: "شش میلیون",
    });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain("مبلغ نامعتبر است.");
  });

  it("rejects an unparseable date rather than defaulting to today", () => {
    const result = createAssetSchema.safeParse({ ...valid, purchaseDate: "دیروز" });

    expect(result.success).toBe(false);
    expect(messages(result)).toContain("تاریخ نامعتبر است.");
  });

  it("requires a name, a type and an owner", () => {
    expect(createAssetSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(createAssetSchema.safeParse({ ...valid, type: "HOUSE" }).success).toBe(
      false,
    );
    expect(createAssetSchema.safeParse({ ...valid, owner: "" }).success).toBe(false);
  });

  it("turns blank optional text into null rather than an empty string", () => {
    const parsed = createAssetSchema.parse({ ...valid, unit: "  ", notes: "" });

    expect(parsed.unit).toBeNull();
    expect(parsed.notes).toBeNull();
  });
});

describe("updateAssetSchema", () => {
  it("accepts any subset of the editable fields", () => {
    expect(updateAssetSchema.parse({ name: "طلا" })).toEqual({ name: "طلا" });
  });

  it("rejects an update that changes nothing", () => {
    const result = updateAssetSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(messages(result)).toContain("هیچ تغییری ارسال نشده است.");
  });

  it("drops a type, which cannot be changed after the asset exists", () => {
    // Every valuation already recorded was taken in the old shape; letting
    // the type move would make that history describe something else.
    expect(updateAssetSchema.parse({ name: "x", type: "GOLD" } as never)).toEqual({
      name: "x",
    });
  });

  it("drops isActive, because archiving has its own endpoint", () => {
    expect(updateAssetSchema.parse({ name: "x", isActive: false } as never)).toEqual({
      name: "x",
    });
  });

  it("applies the same amount rules as create", () => {
    expect(updateAssetSchema.safeParse({ quantity: "0" }).success).toBe(false);
    expect(updateAssetSchema.safeParse({ purchaseUnitPrice: "-1" }).success).toBe(
      false,
    );
  });
});

describe("recordValuationSchema", () => {
  it("needs only a price; today is the obvious default for the date", () => {
    const parsed = recordValuationSchema.parse({ unitPrice: "8,000,000" });

    expect(parsed.unitPrice).toBe(80_000_000n);
    expect(parsed.asOf).toBeUndefined();
    expect(parsed.note).toBeNull();
  });

  it("takes a date when one is given", () => {
    const parsed = recordValuationSchema.parse({
      unitPrice: "1",
      asOf: "2026-06-21T00:00:00.000Z",
    });

    expect(parsed.asOf?.toISOString()).toBe("2026-06-21T00:00:00.000Z");
  });

  it("rejects a negative price", () => {
    expect(recordValuationSchema.safeParse({ unitPrice: "-5" }).success).toBe(false);
  });
});

describe("assetFiltersSchema", () => {
  it("hides archived assets unless asked", () => {
    expect(assetFiltersSchema.parse({}).includeArchived).toBe(false);
    expect(assetFiltersSchema.parse({ includeArchived: "true" }).includeArchived).toBe(
      true,
    );
  });

  it('reads "false" as false, which Boolean("false") would not', () => {
    expect(assetFiltersSchema.parse({ includeArchived: "false" }).includeArchived).toBe(
      false,
    );
  });

  it("rejects an empty owner or a type it does not know", () => {
    expect(assetFiltersSchema.safeParse({ owner: "" }).success).toBe(false);
    expect(assetFiltersSchema.safeParse({ type: "HOUSE" }).success).toBe(false);
  });
});
