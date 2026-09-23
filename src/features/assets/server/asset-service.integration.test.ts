import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppRuleError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ONE_QUANTITY, parseQuantity } from "@/utils/quantity";
import {
  archiveAsset,
  assetValueAsOf,
  assetValuesAt,
  createAsset,
  getAsset,
  getPortfolioSummary,
  listAssets,
  listValuations,
  recordValuation,
  restoreAsset,
  updateAsset,
} from "@/features/assets/server/asset-service";
import {
  assetFiltersSchema,
  createAssetSchema,
  recordValuationSchema,
  updateAssetSchema,
} from "@/features/assets/schemas";

/**
 * Run against a real PostgreSQL database rather than a mock: several of the
 * rules under test are enforced by CHECK constraints, and a mock would
 * happily accept rows the database rejects.
 */

const allAssets = assetFiltersSchema.parse({ includeArchived: true });
const activeAssets = assetFiltersSchema.parse({});

const PURCHASED = new Date("2026-03-20T00:00:00.000Z");

async function makeGold(overrides: Record<string, unknown> = {}) {
  return createAsset(
    createAssetSchema.parse({
      name: "سکه و طلا",
      type: "GOLD",
      owner: "SHARED",
      quantity: "18.5",
      // 6,840,000 Toman a gram.
      purchaseUnitPrice: "6,840,000",
      purchaseDate: PURCHASED,
      ...overrides,
    }),
  );
}

async function makeCar(overrides: Record<string, unknown> = {}) {
  return createAsset(
    createAssetSchema.parse({
      name: "پژو ۲۰۷",
      type: "CAR",
      owner: "REZA",
      purchaseUnitPrice: "1,400,000,000",
      purchaseDate: PURCHASED,
      ...overrides,
    }),
  );
}

async function clearAssets() {
  await prisma.assetValuation.deleteMany();
  await prisma.asset.deleteMany();
}

beforeEach(clearAssets);
afterEach(clearAssets);

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createAsset — quantity-based (3.3)", () => {
  it("stores the quantity scaled and the price as Rial", async () => {
    const asset = await makeGold();

    expect(asset.kind).toBe("QUANTITY");
    expect(asset.quantity).toBe("1850000000");
    expect(asset.purchaseUnitPrice).toBe("68400000");
    // 18.5 × 68,400,000 Rial.
    expect(asset.purchaseTotal).toBe("1265400000");
  });

  it("fills in the unit the type implies", async () => {
    expect((await makeGold()).unit).toBe("گرم");
    expect((await makeGold({ type: "CRYPTO", name: "بیت‌کوین" })).unit).toBe("واحد");
  });

  it("keeps a unit the user typed", async () => {
    expect((await makeGold({ unit: "مثقال" })).unit).toBe("مثقال");
  });

  it("shows no profit before anything has been re-priced", async () => {
    const asset = await makeGold();

    expect(asset.currentValue).toBe(asset.purchaseTotal);
    expect(asset.profitLoss).toBe("0");
    expect(asset.returnRatio).toBe(0);
  });

  it("applies a current price when one is given (3.5, 3.6)", async () => {
    const asset = await makeGold({ currentUnitPrice: "8,000,000" });

    expect(asset.currentUnitPrice).toBe("80000000");
    // 18.5 × 80,000,000.
    expect(asset.currentValue).toBe("1480000000");
    expect(asset.profitLoss).toBe("214600000");
    expect(asset.returnRatio).toBeCloseTo(0.1696, 4);
  });
});

describe("createAsset — fixed-value (3.4)", () => {
  it("is exactly one of itself, whatever the request said", async () => {
    const car = await makeCar({ quantity: "7", unit: "دستگاه" });

    expect(car.kind).toBe("FIXED");
    expect(car.quantity).toBe(ONE_QUANTITY.toString());
    expect(car.unit).toBeNull();
    // The purchase price is the purchase value: quantity is one.
    expect(car.purchaseTotal).toBe("14000000000");
  });

  it("values at the price given, through the same multiplication", async () => {
    const car = await makeCar({ currentUnitPrice: "1,190,000,000" });

    expect(car.currentValue).toBe("11900000000");
    expect(car.profitLoss).toBe("-2100000000");
    expect(car.returnRatio).toBeCloseTo(-0.15, 10);
  });
});

describe("createAsset — opening history (3.8)", () => {
  it("opens the history at the purchase date, not at now", async () => {
    const asset = await makeGold();
    const rows = await listValuations(asset.id);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "INITIAL",
      asOf: PURCHASED.toISOString(),
      unitPrice: "68400000",
      quantity: "1850000000",
      value: "1265400000",
    });
  });

  it("records the current price as a second, later row", async () => {
    const asset = await makeGold({ currentUnitPrice: "8,000,000" });
    const rows = await listValuations(asset.id);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.source).toBe("INITIAL");
    expect(rows[1]!.source).toBe("MANUAL");
    expect(new Date(rows[1]!.asOf).getTime()).toBeGreaterThan(PURCHASED.getTime());
  });

  it("writes no second row when the current price equals what was paid", async () => {
    const asset = await makeGold({ currentUnitPrice: "6,840,000" });
    expect(await listValuations(asset.id)).toHaveLength(1);
  });
});

describe("recordValuation (3.8)", () => {
  it("appends a row and moves the current value", async () => {
    const asset = await makeGold();

    await recordValuation(
      asset.id,
      recordValuationSchema.parse({
        unitPrice: "8,000,000",
        asOf: new Date("2026-06-21T00:00:00.000Z"),
      }),
    );

    const updated = await getAsset(asset.id);

    expect(updated?.currentUnitPrice).toBe("80000000");
    expect(updated?.currentValue).toBe("1480000000");
    expect(updated?.lastValuedAt).toBe("2026-06-21T00:00:00.000Z");
    expect(await listValuations(asset.id)).toHaveLength(2);
  });

  it("does not rewrite what the asset was worth before (3.8, G.4)", async () => {
    const asset = await makeGold();
    const before = await listValuations(asset.id);

    await recordValuation(
      asset.id,
      recordValuationSchema.parse({ unitPrice: "9,000,000" }),
    );

    const after = await listValuations(asset.id);

    // The opening row is byte-for-byte what it was.
    expect(after[0]).toEqual(before[0]);
    expect(after).toHaveLength(2);
  });

  it("treats a second price at the same instant as a correction, not a point", async () => {
    const asset = await makeGold();
    const asOf = new Date("2026-06-21T00:00:00.000Z");

    await recordValuation(
      asset.id,
      recordValuationSchema.parse({ unitPrice: "8,000,000", asOf }),
    );
    await recordValuation(
      asset.id,
      recordValuationSchema.parse({ unitPrice: "8,500,000", asOf }),
    );

    const rows = await listValuations(asset.id);

    expect(rows).toHaveLength(2);
    expect(rows[1]!.unitPrice).toBe("85000000");
  });

  it("stores the quantity the valuation was taken against", async () => {
    const asset = await makeGold();

    const row = await recordValuation(
      asset.id,
      recordValuationSchema.parse({ unitPrice: "8,000,000" }),
    );

    expect(row.quantity).toBe("1850000000");
    expect(row.value).toBe("1480000000");
  });

  it("refuses to price an archived asset", async () => {
    const asset = await makeGold();
    await archiveAsset(asset.id);

    await expect(
      recordValuation(asset.id, recordValuationSchema.parse({ unitPrice: "1" })),
    ).rejects.toMatchObject({ code: "ASSET_ARCHIVED" });
  });

  it("reports a missing asset rather than creating one", async () => {
    await expect(
      recordValuation("nope", recordValuationSchema.parse({ unitPrice: "1" })),
    ).rejects.toBeInstanceOf(AppRuleError);
  });
});

describe("updateAsset (3.2)", () => {
  it("edits the fields it was given and leaves the rest", async () => {
    const asset = await makeGold();

    const updated = await updateAsset(
      asset.id,
      updateAssetSchema.parse({ name: "طلای آب‌شده", owner: "YEGANEH" }),
    );

    expect(updated.name).toBe("طلای آب‌شده");
    expect(updated.owner).toBe("YEGANEH");
    expect(updated.quantity).toBe(asset.quantity);
  });

  it("cannot change an asset's type", async () => {
    const asset = await makeCar();

    // The schema drops it; the shape of the row and its history stay put.
    const updated = await updateAsset(
      asset.id,
      updateAssetSchema.parse({ type: "GOLD", name: "پژو" } as never),
    );

    expect(updated.type).toBe("CAR");
    expect(updated.kind).toBe("FIXED");
  });

  it("records a valuation when the holding changes, without touching history", async () => {
    const asset = await makeGold();
    const before = await listValuations(asset.id);

    const updated = await updateAsset(
      asset.id,
      updateAssetSchema.parse({ quantity: "22" }),
    );

    const after = await listValuations(asset.id);

    expect(updated.quantity).toBe(parseQuantity("22")!.toString());
    expect(updated.currentValue).toBe((68_400_000n * 22n).toString());
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]!.quantity).toBe(parseQuantity("22")!.toString());
  });

  it("records nothing extra when the holding did not change", async () => {
    const asset = await makeGold();

    await updateAsset(asset.id, updateAssetSchema.parse({ name: "طلا" }));

    expect(await listValuations(asset.id)).toHaveLength(1);
  });

  it("keeps a fixed asset at a quantity of one", async () => {
    const car = await makeCar();

    const updated = await updateAsset(
      car.id,
      updateAssetSchema.parse({ quantity: "3" }),
    );

    expect(updated.quantity).toBe(ONE_QUANTITY.toString());
    expect(await listValuations(car.id)).toHaveLength(1);
  });

  it("refuses to edit an archived asset", async () => {
    const asset = await makeGold();
    await archiveAsset(asset.id);

    await expect(
      updateAsset(asset.id, updateAssetSchema.parse({ name: "x" })),
    ).rejects.toMatchObject({ code: "ASSET_ARCHIVED" });
  });
});

describe("archiveAsset / restoreAsset (3.2)", () => {
  it("hides an archived asset from the default list but keeps its history", async () => {
    const asset = await makeGold();
    await archiveAsset(asset.id);

    expect(await listAssets(activeAssets)).toHaveLength(0);
    expect(await listAssets(allAssets)).toHaveLength(1);
    expect(await listValuations(asset.id)).toHaveLength(1);
  });

  it("refuses to archive twice, and to restore what is not archived", async () => {
    const asset = await makeGold();
    await archiveAsset(asset.id);

    await expect(archiveAsset(asset.id)).rejects.toMatchObject({
      code: "ALREADY_ARCHIVED",
    });
    await restoreAsset(asset.id);
    await expect(restoreAsset(asset.id)).rejects.toMatchObject({
      code: "ALREADY_ACTIVE",
    });
  });
});

describe("listAssets", () => {
  it("filters by owner and by type", async () => {
    await makeGold();
    await makeCar();

    expect(await listAssets(assetFiltersSchema.parse({ owner: "REZA" }))).toHaveLength(
      1,
    );
    expect(await listAssets(assetFiltersSchema.parse({ type: "GOLD" }))).toHaveLength(
      1,
    );
  });

  it("values every asset from its own latest price", async () => {
    const gold = await makeGold();
    await makeCar({ currentUnitPrice: "1,190,000,000" });
    await recordValuation(
      gold.id,
      recordValuationSchema.parse({ unitPrice: "8,000,000" }),
    );

    const assets = await listAssets(activeAssets);
    const byName = new Map(assets.map((asset) => [asset.name, asset]));

    expect(byName.get("سکه و طلا")?.currentValue).toBe("1480000000");
    expect(byName.get("پژو ۲۰۷")?.currentValue).toBe("11900000000");
  });
});

describe("getPortfolioSummary (3.7)", () => {
  it("totals value, cost and P/L, and breaks the value down by type", async () => {
    await makeGold({ currentUnitPrice: "8,000,000" });
    await makeCar({ currentUnitPrice: "1,190,000,000" });

    const summary = await getPortfolioSummary();

    expect(summary.assetCount).toBe(2);
    expect(summary.totalValue).toBe((1_480_000_000n + 11_900_000_000n).toString());
    expect(summary.totalCost).toBe((1_265_400_000n + 14_000_000_000n).toString());
    expect(summary.profitLoss).toBe("-1885400000");

    const shares = new Map(summary.byType.map((row) => [row.type, row]));
    expect(shares.get("CAR")?.share).toBeCloseTo(11_900 / 13_380, 4);
    expect(shares.get("GOLD")?.share).toBeCloseTo(1_480 / 13_380, 4);
    // Largest first.
    expect(summary.byType[0]!.type).toBe("CAR");
  });

  it("leaves archived assets out of the portfolio", async () => {
    const gold = await makeGold();
    await makeCar();
    await archiveAsset(gold.id);

    const summary = await getPortfolioSummary();

    expect(summary.assetCount).toBe(1);
    expect(summary.totalValue).toBe("14000000000");
  });

  it("is zero and empty with nothing held", async () => {
    expect(await getPortfolioSummary()).toMatchObject({
      totalValue: "0",
      totalCost: "0",
      profitLoss: "0",
      returnRatio: null,
      assetCount: 0,
      byType: [],
    });
  });
});

describe("assetValueAsOf (3.9)", () => {
  it("is zero before the asset was bought", async () => {
    await makeGold();

    expect(await assetValueAsOf(new Date("2026-01-01T00:00:00.000Z"))).toBe(0n);
  });

  it("is the purchase value from the purchase date on", async () => {
    await makeGold();

    expect(await assetValueAsOf(PURCHASED)).toBe(1_265_400_000n);
    expect(await assetValueAsOf(new Date("2026-05-01T00:00:00.000Z"))).toBe(
      1_265_400_000n,
    );
  });

  it("uses the price in force at the instant asked for, not today's", async () => {
    const gold = await makeGold();

    await recordValuation(
      gold.id,
      recordValuationSchema.parse({
        unitPrice: "8,000,000",
        asOf: new Date("2026-06-21T00:00:00.000Z"),
      }),
    );

    // Before the re-pricing, the old price still stands.
    expect(await assetValueAsOf(new Date("2026-06-20T00:00:00.000Z"))).toBe(
      1_265_400_000n,
    );
    expect(await assetValueAsOf(new Date("2026-06-22T00:00:00.000Z"))).toBe(
      1_480_000_000n,
    );
  });

  it("drops an archived asset out of the total", async () => {
    const gold = await makeGold();
    await makeCar();
    await archiveAsset(gold.id);

    expect(await assetValueAsOf(new Date("2026-05-01T00:00:00.000Z"))).toBe(
      14_000_000_000n,
    );
  });
});

describe("assetValuesAt (3.10)", () => {
  it("walks the series forward, carrying each re-pricing", async () => {
    const gold = await makeGold();

    await recordValuation(
      gold.id,
      recordValuationSchema.parse({
        unitPrice: "8,000,000",
        asOf: new Date("2026-06-21T00:00:00.000Z"),
      }),
    );
    await recordValuation(
      gold.id,
      recordValuationSchema.parse({
        unitPrice: "7,000,000",
        asOf: new Date("2026-08-21T00:00:00.000Z"),
      }),
    );

    const values = await assetValuesAt([
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-09-01T00:00:00.000Z"),
    ]);

    expect(values).toEqual([0n, 1_265_400_000n, 1_480_000_000n, 1_295_000_000n]);
  });

  it("is an empty series for no points", async () => {
    expect(await assetValuesAt([])).toEqual([]);
  });
});

describe("cost basis after an edit (3.6)", () => {
  it("follows the holding, so buying more does not invent a profit", async () => {
    const asset = await makeGold();

    await recordValuation(
      asset.id,
      recordValuationSchema.parse({
        unitPrice: "6,840,000",
        asOf: new Date("2026-06-21T00:00:00.000Z"),
      }),
    );

    // Four more grams at the same price the rest was bought at.
    const updated = await updateAsset(
      asset.id,
      updateAssetSchema.parse({ quantity: "22.5" }),
    );

    // 22.5 grams at 6,840,000 Toman, bought and valued at the same price:
    // more money in, no gain.
    expect(updated.purchaseTotal).toBe(((68_400_000n * 225n) / 10n).toString());
    expect(updated.currentValue).toBe(updated.purchaseTotal);
    expect(updated.profitLoss).toBe("0");
  });

  it("re-prices the whole holding, not just the part first bought", async () => {
    const asset = await makeGold();

    await updateAsset(asset.id, updateAssetSchema.parse({ quantity: "37" }));
    const updated = await recordValuation(
      asset.id,
      recordValuationSchema.parse({
        unitPrice: "8,000,000",
        asOf: new Date("2026-07-21T00:00:00.000Z"),
      }),
    );

    expect(updated.quantity).toBe(parseQuantity("37")!.toString());
    expect(updated.value).toBe((80_000_000n * 37n).toString());
  });
});

describe("restoring an asset (3.2)", () => {
  it("brings it back into the portfolio with its history intact", async () => {
    const gold = await makeGold();
    await recordValuation(
      gold.id,
      recordValuationSchema.parse({
        unitPrice: "8,000,000",
        asOf: new Date("2026-06-21T00:00:00.000Z"),
      }),
    );

    await archiveAsset(gold.id);
    expect((await getPortfolioSummary()).totalValue).toBe("0");
    expect(await assetValueAsOf(new Date("2026-07-01T00:00:00.000Z"))).toBe(0n);

    await restoreAsset(gold.id);

    expect((await getPortfolioSummary()).totalValue).toBe("1480000000");
    expect(await assetValueAsOf(new Date("2026-07-01T00:00:00.000Z"))).toBe(
      1_480_000_000n,
    );
    expect(await listValuations(gold.id)).toHaveLength(2);
  });
});

describe("several assets bought at different times (3.9)", () => {
  it("each joins the total on its own purchase date", async () => {
    await makeCar({ purchaseDate: new Date("2025-11-02T00:00:00.000Z") });
    await makeGold(); // 2026-03-20

    const before = new Date("2026-01-01T00:00:00.000Z");
    const after = new Date("2026-04-01T00:00:00.000Z");

    expect(await assetValueAsOf(before)).toBe(14_000_000_000n);
    expect(await assetValueAsOf(after)).toBe(14_000_000_000n + 1_265_400_000n);
  });
});

describe("database constraints", () => {
  it("rejects a valuation whose total does not match its own price and quantity", async () => {
    const asset = await makeGold();

    await expect(
      prisma.assetValuation.create({
        data: {
          assetId: asset.id,
          unitPrice: 100n,
          quantity: ONE_QUANTITY,
          // Should be 100.
          value: 999n,
          asOf: new Date("2027-01-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow(/asset_valuations_value_matches_product/);
  });

  it("rejects a holding of nothing", async () => {
    await expect(
      prisma.asset.create({
        data: {
          name: "هیچ",
          type: "GOLD",
          kind: "QUANTITY",
          owner: "SHARED",
          quantity: 0n,
          unit: "گرم",
          purchaseUnitPrice: 1n,
          purchaseDate: PURCHASED,
        },
      }),
    ).rejects.toThrow(/assets_quantity_positive/);
  });
});
