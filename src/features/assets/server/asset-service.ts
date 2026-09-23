import "server-only";

import type { AssetModel, AssetValuationModel } from "@/generated/prisma/models";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { multiplyByQuantity, ONE_QUANTITY } from "@/utils/quantity";
import { foldAssetValues, type ValuationRow } from "@/features/assets/history";
import { portfolioTotals, profitAndLoss, ratioOf } from "@/features/assets/valuation";
import type {
  AssetFilters,
  CreateAssetInput,
  RecordValuationInput,
  UpdateAssetInput,
} from "@/features/assets/schemas";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  DEFAULT_ASSET_UNIT,
  assetKindOf,
  type AssetDto,
  type AssetType,
  type AssetTypeShare,
  type AssetValuationDto,
  type PortfolioSummary,
} from "@/features/assets/types";
import { assertOwner } from "@/features/members/server/member-service";

/**
 * Asset data access and business rules (tasks 3.2 and 3.8).
 *
 * Everything that reads or writes an asset goes through here: the REST
 * handlers, the server components and the tests. The arithmetic itself lives
 * in `valuation.ts` and `history.ts`, which have no database and can be
 * tested on their own.
 *
 * The rule that shapes this file: **an asset's value is never a column.**
 * What it is worth now is the latest row in its valuation history, so
 * re-pricing appends a fact rather than overwriting one, and last month's
 * figures keep saying what they said last month (rule G.4, task 3.8).
 */

/** The unit a per-unit holding is counted in, never empty. */
function resolveUnit(type: AssetType, unit: string | null | undefined): string | null {
  if (assetKindOf(type) === "FIXED") return null;
  return unit?.trim() || DEFAULT_ASSET_UNIT[type] || "واحد";
}

/** A fixed-value asset is exactly one of itself; see the schema comment. */
function resolveQuantity(type: AssetType, quantity: bigint): bigint {
  return assetKindOf(type) === "FIXED" ? ONE_QUANTITY : quantity;
}

/* -------------------------------------------------------------------------
 * Reading the latest valuation
 * ---------------------------------------------------------------------- */

/**
 * The most recent valuation of each of these assets, in two queries.
 *
 * Not one query per asset: a portfolio page showing twenty holdings would
 * otherwise cost twenty-one round trips, which is the pattern task 2.10 asks
 * the dashboard never to fall into. The group-by finds each asset's latest
 * instant and the second query fetches exactly those rows.
 */
async function loadLatestValuations(
  assetIds: readonly string[],
): Promise<Map<string, AssetValuationModel>> {
  const latest = new Map<string, AssetValuationModel>();
  if (assetIds.length === 0) return latest;

  const newest = await prisma.assetValuation.groupBy({
    by: ["assetId"],
    where: { assetId: { in: [...assetIds] } },
    _max: { asOf: true },
  });

  const targets = newest
    .filter((row) => row._max.asOf !== null)
    .map((row) => ({ assetId: row.assetId, asOf: row._max.asOf! }));

  if (targets.length === 0) return latest;

  const rows = await prisma.assetValuation.findMany({ where: { OR: targets } });
  for (const row of rows) latest.set(row.assetId, row);

  return latest;
}

/* -------------------------------------------------------------------------
 * DTOs
 * ---------------------------------------------------------------------- */

function toDto(asset: AssetModel, latest: AssetValuationModel | undefined): AssetDto {
  // Falling back to the purchase price rather than to zero: an asset that has
  // never been re-priced is worth what it cost, and zero would wipe it out of
  // net worth entirely.
  const currentUnitPrice = latest?.unitPrice ?? asset.purchaseUnitPrice;

  const { value, cost, profitLoss, returnRatio } = profitAndLoss({
    quantity: asset.quantity,
    purchaseUnitPrice: asset.purchaseUnitPrice,
    currentUnitPrice,
  });

  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    kind: asset.kind,
    owner: asset.owner,
    quantity: asset.quantity.toString(),
    unit: asset.unit,
    purchaseUnitPrice: asset.purchaseUnitPrice.toString(),
    purchaseTotal: cost.toString(),
    currentUnitPrice: currentUnitPrice.toString(),
    currentValue: value.toString(),
    profitLoss: profitLoss.toString(),
    returnRatio,
    lastValuedAt: latest?.asOf.toISOString() ?? null,
    purchaseDate: asset.purchaseDate.toISOString(),
    notes: asset.notes,
    isActive: asset.isActive,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function valuationToDto(row: AssetValuationModel): AssetValuationDto {
  return {
    id: row.id,
    assetId: row.assetId,
    unitPrice: row.unitPrice.toString(),
    quantity: row.quantity.toString(),
    value: row.value.toString(),
    asOf: row.asOf.toISOString(),
    source: row.source,
    note: row.note,
  };
}

async function toDtos(assets: AssetModel[]): Promise<AssetDto[]> {
  const latest = await loadLatestValuations(assets.map((asset) => asset.id));
  return assets.map((asset) => toDto(asset, latest.get(asset.id)));
}

/* -------------------------------------------------------------------------
 * CRUD (task 3.2)
 * ---------------------------------------------------------------------- */

export async function listAssets(filters: AssetFilters): Promise<AssetDto[]> {
  const assets = await prisma.asset.findMany({
    where: {
      ...(filters.includeArchived ? {} : { isActive: true }),
      ...(filters.owner ? { owner: filters.owner } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    },
    // Active first, then most recently added: an archived holding should
    // never sit above a live one in a list that shows both.
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return toDtos(assets);
}

export async function getAsset(id: string): Promise<AssetDto | null> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return null;

  const latest = await loadLatestValuations([asset.id]);
  return toDto(asset, latest.get(asset.id));
}

/**
 * Add an asset, and open its valuation history.
 *
 * The opening row is dated the *purchase date*, not now. That is what makes
 * the net-worth history in task 3.10 honest: a car bought in Mordad appears
 * in Mordad, rather than being back-projected across a year the household
 * did not own it.
 *
 * A separate current price is only written when one was given and it differs
 * from what was paid. Inventing one would show a profit nobody made.
 */
export async function createAsset(input: CreateAssetInput): Promise<AssetDto> {
  await assertOwner(input.owner);
  const kind = assetKindOf(input.type);
  const quantity = resolveQuantity(input.type, input.quantity);
  const unit = resolveUnit(input.type, input.unit);

  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: {
        name: input.name,
        type: input.type,
        kind,
        owner: input.owner,
        quantity,
        unit,
        purchaseUnitPrice: input.purchaseUnitPrice,
        purchaseDate: input.purchaseDate,
        notes: input.notes,
      },
    });

    await tx.assetValuation.create({
      data: {
        assetId: asset.id,
        unitPrice: asset.purchaseUnitPrice,
        quantity,
        value: multiplyByQuantity(asset.purchaseUnitPrice, quantity),
        asOf: asset.purchaseDate,
        source: "INITIAL",
      },
    });

    const hasCurrent =
      input.currentUnitPrice !== undefined &&
      input.currentUnitPrice !== input.purchaseUnitPrice;

    if (!hasCurrent) return toDto(asset, undefined);

    const now = new Date();
    const current = await tx.assetValuation.upsert({
      where: { assetId_asOf: { assetId: asset.id, asOf: now } },
      create: {
        assetId: asset.id,
        unitPrice: input.currentUnitPrice!,
        quantity,
        value: multiplyByQuantity(input.currentUnitPrice!, quantity),
        asOf: now,
        source: "MANUAL",
      },
      update: {},
    });

    return toDto(asset, current);
  });
}

/**
 * Edit an asset.
 *
 * A change of holding — buying two more grams, selling half — records a new
 * valuation at the current price, because the portfolio is worth something
 * different from this moment on. It does not touch the rows already written:
 * what the household owned last month did not change because it owns more
 * today (rule G.4).
 */
export async function updateAsset(
  id: string,
  input: UpdateAssetInput,
): Promise<AssetDto> {
  if (input.owner !== undefined) await assertOwner(input.owner);
  const existing = await requireAsset(id);

  if (!existing.isActive) {
    throw new ConflictError(
      "دارایی بایگانی‌شده قابل ویرایش نیست. ابتدا آن را از بایگانی خارج کنید.",
      "ASSET_ARCHIVED",
    );
  }

  const quantity =
    input.quantity === undefined
      ? existing.quantity
      : resolveQuantity(existing.type, input.quantity);

  const unit =
    input.unit === undefined ? existing.unit : resolveUnit(existing.type, input.unit);

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.owner === undefined ? {} : { owner: input.owner }),
      ...(input.purchaseUnitPrice === undefined
        ? {}
        : { purchaseUnitPrice: input.purchaseUnitPrice }),
      ...(input.purchaseDate === undefined ? {} : { purchaseDate: input.purchaseDate }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      quantity,
      unit,
    },
  });

  if (quantity !== existing.quantity) {
    const latest = await loadLatestValuations([id]);
    const unitPrice = latest.get(id)?.unitPrice ?? asset.purchaseUnitPrice;
    const now = new Date();

    await prisma.assetValuation.upsert({
      where: { assetId_asOf: { assetId: id, asOf: now } },
      create: {
        assetId: id,
        unitPrice,
        quantity,
        value: multiplyByQuantity(unitPrice, quantity),
        asOf: now,
        source: "MANUAL",
      },
      update: { quantity, value: multiplyByQuantity(unitPrice, quantity) },
    });
  }

  const latest = await loadLatestValuations([id]);
  return toDto(asset, latest.get(id));
}

/**
 * Archive an asset.
 *
 * Assets are never deleted: the valuation history behind them is what makes
 * past net worth correct, and removing it would rewrite figures the household
 * has already seen (rule G.4). An archived asset keeps every row it has and
 * simply stops counting toward the portfolio and toward net worth — which is
 * exactly what selling it means.
 */
export async function archiveAsset(id: string): Promise<AssetDto> {
  const existing = await requireAsset(id);

  if (!existing.isActive) {
    throw new ConflictError("این دارایی از قبل بایگانی شده است.", "ALREADY_ARCHIVED");
  }

  const asset = await prisma.asset.update({ where: { id }, data: { isActive: false } });
  const latest = await loadLatestValuations([id]);

  return toDto(asset, latest.get(id));
}

export async function restoreAsset(id: string): Promise<AssetDto> {
  const existing = await requireAsset(id);

  if (existing.isActive) {
    throw new ConflictError("این دارایی بایگانی نشده است.", "ALREADY_ACTIVE");
  }

  const asset = await prisma.asset.update({ where: { id }, data: { isActive: true } });
  const latest = await loadLatestValuations([id]);

  return toDto(asset, latest.get(id));
}

async function requireAsset(id: string): Promise<AssetModel> {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new NotFoundError("دارایی پیدا نشد.");

  return asset;
}

/* -------------------------------------------------------------------------
 * Valuation history (task 3.8)
 * ---------------------------------------------------------------------- */

/**
 * Record what an asset is worth now.
 *
 * This is the only write that changes an asset's current value, and it is an
 * insert. Two valuations at the same instant are a correction of one figure
 * rather than two data points, so the same instant updates in place — every
 * other instant appends, and nothing already written for another instant is
 * touched.
 *
 * The quantity and the total are stored alongside the price, so a later
 * change of holding cannot retroactively re-value this moment.
 */
export async function recordValuation(
  id: string,
  input: RecordValuationInput,
): Promise<AssetValuationDto> {
  const asset = await requireAsset(id);

  if (!asset.isActive) {
    throw new ConflictError(
      "برای دارایی بایگانی‌شده نمی‌توان قیمت ثبت کرد.",
      "ASSET_ARCHIVED",
    );
  }

  const asOf = input.asOf ?? new Date();
  const value = multiplyByQuantity(input.unitPrice, asset.quantity);

  const row = await prisma.assetValuation.upsert({
    where: { assetId_asOf: { assetId: id, asOf } },
    create: {
      assetId: id,
      unitPrice: input.unitPrice,
      quantity: asset.quantity,
      value,
      asOf,
      source: "MANUAL",
      note: input.note,
    },
    update: {
      unitPrice: input.unitPrice,
      quantity: asset.quantity,
      value,
      source: "MANUAL",
      note: input.note,
    },
  });

  return valuationToDto(row);
}

/** An asset's recorded valuations, oldest first. */
export async function listValuations(id: string): Promise<AssetValuationDto[]> {
  const rows = await prisma.assetValuation.findMany({
    where: { assetId: id },
    orderBy: { asOf: "asc" },
  });

  return rows.map(valuationToDto);
}

/* -------------------------------------------------------------------------
 * Portfolio (task 3.7)
 * ---------------------------------------------------------------------- */

/**
 * The portfolio's totals and its breakdown by type.
 *
 * Archived assets are excluded: the household no longer holds them, and
 * counting them would overstate what it owns.
 *
 * Shares are taken against the total of the *positive* values, for the same
 * reason the account distribution is (task 2.5) — though an asset cannot
 * currently be worth less than nothing, so in practice the two totals agree.
 * The guard is here so a future liability-shaped asset cannot push the other
 * shares past 100%.
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const assets = await listAssets({ includeArchived: false });

  const totals = portfolioTotals(
    assets.map((asset) => ({
      value: BigInt(asset.currentValue),
      cost: BigInt(asset.purchaseTotal),
    })),
  );

  const byType = new Map<AssetType, { value: bigint; count: number }>();

  for (const asset of assets) {
    const bucket = byType.get(asset.type) ?? { value: 0n, count: 0 };
    bucket.value += BigInt(asset.currentValue);
    bucket.count += 1;
    byType.set(asset.type, bucket);
  }

  const positiveTotal = [...byType.values()].reduce(
    (sum, bucket) => (bucket.value > 0n ? sum + bucket.value : sum),
    0n,
  );

  const shares: AssetTypeShare[] = ASSET_TYPES.filter((type) => byType.has(type))
    .map((type) => {
      const bucket = byType.get(type)!;

      return {
        type,
        label: ASSET_TYPE_LABELS[type],
        value: bucket.value.toString(),
        count: bucket.count,
        share:
          positiveTotal === 0n || bucket.value <= 0n
            ? 0
            : Number(bucket.value) / Number(positiveTotal),
      };
    })
    .sort((a, b) => (BigInt(b.value) > BigInt(a.value) ? 1 : -1));

  return {
    totalValue: totals.value.toString(),
    totalCost: totals.cost.toString(),
    profitLoss: totals.profitLoss.toString(),
    returnRatio: ratioOf(totals.profitLoss, totals.cost),
    assetCount: assets.length,
    byType: shares,
  };
}

/* -------------------------------------------------------------------------
 * Net worth (tasks 3.9 and 3.10)
 * ---------------------------------------------------------------------- */

/**
 * Every valuation of every currently-held asset, up to an instant.
 *
 * One query, sorted, so the callers below can sweep it. Archived assets are
 * excluded throughout: the household does not own them, so they are not part
 * of its net worth at any point on the line.
 */
async function loadValuationTimeline(until: Date): Promise<ValuationRow[]> {
  const rows = await prisma.assetValuation.findMany({
    where: { asOf: { lte: until }, asset: { isActive: true } },
    select: { assetId: true, asOf: true, value: true },
    orderBy: { asOf: "asc" },
  });

  return rows;
}

/**
 * Total value of the assets held at an instant (task 3.9).
 *
 * The figure that enters net worth. It counts only what had been valued by
 * then, so last month's net worth is not inflated by an asset bought this
 * month.
 */
export async function assetValueAsOf(asOf: Date): Promise<bigint> {
  const rows = await loadValuationTimeline(asOf);
  return foldAssetValues(rows, [asOf])[0] ?? 0n;
}

/**
 * Total asset value at each of a series of instants (task 3.10).
 *
 * One query for the whole series regardless of how many points are asked
 * for — the same guarantee the balance history gives, and what keeps the
 * dashboard's query count flat as the chart's range grows.
 */
export async function assetValuesAt(points: readonly Date[]): Promise<bigint[]> {
  const last = points[points.length - 1];
  if (!last) return [];

  const rows = await loadValuationTimeline(last);
  return foldAssetValues(rows, points);
}
