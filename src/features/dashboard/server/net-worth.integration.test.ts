import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { fromJalaliDate } from "@/utils/date";
import { createAccountSchema } from "@/features/accounts/schemas";
import { createAccount } from "@/features/accounts/server/account-service";
import { createAssetSchema, recordValuationSchema } from "@/features/assets/schemas";
import {
  archiveAsset,
  createAsset,
  recordValuation,
} from "@/features/assets/server/asset-service";
import {
  getDashboardSummary,
  getNetWorthHistory,
} from "@/features/dashboard/server/dashboard-service";

/**
 * Tasks 3.9 and 3.10: net worth once assets exist.
 *
 *   Net worth = assets + account balances − liabilities
 *
 * The two properties worth testing are that the arithmetic is right, and
 * that nothing is counted twice. Liabilities arrive in Sprint 4 and are zero
 * throughout; the term is still in the sum.
 */

const MONTH = { year: 1405, month: 6 };

/** Day `day` of a Jalali month, as the instant to store. */
const on = (month: { year: number; month: number }, day: number) =>
  new Date(fromJalaliDate({ ...month, day }).getTime() + 9 * 3_600_000);

/** Mid-Shahrivar, so "now" sits inside the month under test. */
const NOW = on(MONTH, 20);

let bank: Awaited<ReturnType<typeof createAccount>>;

beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.assetValuation.deleteMany();
  await prisma.asset.deleteMany();

  bank = await createAccount(
    createAccountSchema.parse({
      name: "بانک ملت",
      type: "BANK",
      owner: "SHARED",
      // 50,000,000 Toman.
      initialBalance: "50,000,000",
    }),
  );
});

afterAll(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.assetValuation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.$disconnect();
});

/** A flat bought in Mordad for 900,000,000 Toman. */
async function buyFlat(purchaseDate = on({ year: 1405, month: 5 }, 1)) {
  return createAsset(
    createAssetSchema.parse({
      name: "آپارتمان",
      type: "PROPERTY",
      owner: "SHARED",
      purchaseUnitPrice: "900,000,000",
      purchaseDate,
    }),
  );
}

describe("net worth includes assets (3.9)", () => {
  it("adds the portfolio to the account balances", async () => {
    await buyFlat();

    const summary = await getDashboardSummary(MONTH);

    expect(summary.current.totalBalance).toBe("500000000");
    expect(summary.current.assetValue).toBe("9000000000");
    expect(summary.current.liabilityValue).toBe("0");
    expect(summary.current.netWorth).toBe("9500000000");
  });

  it("follows the latest recorded price, not the purchase price", async () => {
    const flat = await buyFlat();

    await recordValuation(
      flat.id,
      recordValuationSchema.parse({
        unitPrice: "1,200,000,000",
        asOf: on(MONTH, 5),
      }),
    );

    const summary = await getDashboardSummary(MONTH);

    expect(summary.current.assetValue).toBe("12000000000");
    expect(summary.current.netWorth).toBe("12500000000");
  });

  it("drops an archived asset out of net worth", async () => {
    const flat = await buyFlat();
    await archiveAsset(flat.id);

    const summary = await getDashboardSummary(MONTH);

    expect(summary.current.assetValue).toBe("0");
    expect(summary.current.netWorth).toBe("500000000");
  });

  it("is the balance alone when the household owns nothing else", async () => {
    const summary = await getDashboardSummary(MONTH);

    expect(summary.current.assetValue).toBe("0");
    expect(summary.current.netWorth).toBe(summary.current.totalBalance);
  });
});

describe("money is counted once (3.9)", () => {
  it("does not let cash in an account also be an asset", () => {
    // Structural rather than a rule someone has to remember: there is no
    // cash or bank member of AssetType, so the double entry cannot be
    // written in the first place. If a future sprint adds one, this fails.
    const assetTypes = createAssetSchema.shape.type.options as string[];

    expect(assetTypes).not.toContain("CASH");
    expect(assetTypes).not.toContain("BANK");
  });

  it("counts a transfer between accounts in neither balance nor assets", async () => {
    const other = await createAccount(
      createAccountSchema.parse({
        name: "کیف پول",
        type: "WALLET",
        owner: "SHARED",
        initialBalance: "0",
      }),
    );

    await buyFlat();

    await prisma.transaction.create({
      data: {
        type: "TRANSFER",
        amount: 200_000_000n,
        accountId: bank.id,
        toAccountId: other.id,
        owner: "SHARED",
        date: on(MONTH, 3),
      },
    });

    const summary = await getDashboardSummary(MONTH);

    // Moving money did not create or destroy any of it (rule G.3).
    expect(summary.current.totalBalance).toBe("500000000");
    expect(summary.current.netWorth).toBe("9500000000");
  });

  it("does not count buying an asset as spending, nor the asset twice", async () => {
    // Paying for the flat is an expense in the ledger; the flat is an asset.
    // Net worth must move by the difference, not by twice the price.
    await buyFlat(on(MONTH, 2));

    await prisma.transaction.create({
      data: {
        type: "EXPENSE",
        amount: 300_000_000n,
        accountId: bank.id,
        owner: "SHARED",
        date: on(MONTH, 2),
      },
    });

    const summary = await getDashboardSummary(MONTH);

    expect(summary.current.totalBalance).toBe("200000000");
    expect(summary.current.assetValue).toBe("9000000000");
    expect(summary.current.netWorth).toBe("9200000000");
  });
});

describe("net worth history (3.10)", () => {
  it("shows an asset only from the month it was bought", async () => {
    await buyFlat(on({ year: 1405, month: 5 }, 1));

    const points = await getNetWorthHistory("M6", NOW);

    // Six months ending in Shahrivar: Farvardin .. Shahrivar.
    expect(points).toHaveLength(6);
    // Mordad is the fifth.
    expect(points.slice(0, 4).every((point) => point.assets === "0")).toBe(true);
    expect(points[4]!.assets).toBe("9000000000");
    expect(points[5]!.assets).toBe("9000000000");
  });

  it("carries each re-pricing forward from its own date (3.8, G.4)", async () => {
    const flat = await buyFlat(on({ year: 1405, month: 3 }, 1));

    await recordValuation(
      flat.id,
      recordValuationSchema.parse({
        unitPrice: "1,100,000,000",
        asOf: on({ year: 1405, month: 5 }, 1),
      }),
    );

    const points = await getNetWorthHistory("M6", NOW);
    const assets = points.map((point) => point.assets);

    expect(assets).toEqual([
      "0",
      "0",
      "9000000000",
      "9000000000",
      "11000000000",
      "11000000000",
    ]);
  });

  it("re-pricing today does not move what last month was worth", async () => {
    const flat = await buyFlat(on({ year: 1405, month: 3 }, 1));
    const before = await getNetWorthHistory("M6", NOW);

    await recordValuation(
      flat.id,
      recordValuationSchema.parse({ unitPrice: "2,000,000,000", asOf: NOW }),
    );

    const after = await getNetWorthHistory("M6", NOW);

    // Every closed month is untouched; only the point measured at `now`
    // moves, because only that one is after the new price.
    expect(after.slice(0, 5)).toEqual(before.slice(0, 5));
    expect(after[5]!.assets).toBe("20000000000");
  });

  it("adds the balance and the portfolio at every point", async () => {
    await buyFlat(on({ year: 1405, month: 1 }, 1));

    const points = await getNetWorthHistory("M6", NOW);

    for (const point of points) {
      expect(BigInt(point.netWorth)).toBe(
        BigInt(point.assets) + BigInt(point.balance) - BigInt(point.liabilities),
      );
    }
  });

  it("still draws a portfolio held by a household with no accounts", async () => {
    // Without this, owning a flat and no bank account read as "no net
    // worth" on the chart while the assets page showed billions.
    await prisma.account.deleteMany();
    await buyFlat(on({ year: 1405, month: 4 }, 1));

    const points = await getNetWorthHistory("M6", NOW);

    expect(points).toHaveLength(6);
    expect(points[5]!.netWorth).toBe("9000000000");
    expect(points[0]!.netWorth).toBe("0");
  });

  it("is empty when there is nothing at all to draw", async () => {
    await prisma.account.deleteMany();

    expect(await getNetWorthHistory("M6", NOW)).toEqual([]);
  });
});
