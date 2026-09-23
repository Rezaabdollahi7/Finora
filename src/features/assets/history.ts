/**
 * Reading the valuation table as a timeline (tasks 3.8 and 3.10).
 *
 * Pure functions over plain rows, with no Prisma and no database, so the
 * sweep can be tested directly (rule G.11) and so the net-worth engine and
 * the portfolio page share one definition of "what was this worth then".
 */

/** One row of the valuation table, reduced to what a timeline needs. */
export type ValuationRow = {
  assetId: string;
  asOf: Date;
  /** Total value in Rial at `asOf`, as it was recorded. */
  value: bigint;
};

/**
 * Total portfolio value at each of a series of instants.
 *
 * One pass over the rows for the whole series, rather than one query per
 * point: the rows arrive sorted by `asOf`, and a running total is carried
 * forward across the points. Asking for twenty-four months therefore costs
 * the same as asking for three, which is what task 2.10 requires of anything
 * the dashboard calls.
 *
 * The running total tracks each asset's *latest* value rather than summing
 * every row, because a re-pricing replaces an asset's contribution instead of
 * adding to it. An asset with no valuation at or before a point contributes
 * nothing to it — which is how an asset bought in Mordad stays absent from
 * Tir, rather than being projected backwards through history (rule G.4).
 *
 * `points` must be ascending; `rows` must be sorted by `asOf` ascending.
 */
export function foldAssetValues(
  rows: readonly ValuationRow[],
  points: readonly Date[],
): bigint[] {
  const latestByAsset = new Map<string, bigint>();
  let total = 0n;
  let cursor = 0;

  return points.map((point) => {
    while (cursor < rows.length && rows[cursor]!.asOf <= point) {
      const row = rows[cursor]!;
      // Replace this asset's contribution rather than adding to it.
      total += row.value - (latestByAsset.get(row.assetId) ?? 0n);
      latestByAsset.set(row.assetId, row.value);
      cursor += 1;
    }

    return total;
  });
}

/**
 * The value of a single asset at each instant.
 *
 * The same sweep narrowed to one asset, for the chart on an asset's own page.
 * Before its first valuation it is worth nothing rather than worth what it is
 * worth today.
 */
export function foldSingleAssetValues(
  rows: readonly ValuationRow[],
  points: readonly Date[],
): bigint[] {
  let latest = 0n;
  let cursor = 0;

  return points.map((point) => {
    while (cursor < rows.length && rows[cursor]!.asOf <= point) {
      latest = rows[cursor]!.value;
      cursor += 1;
    }

    return latest;
  });
}
