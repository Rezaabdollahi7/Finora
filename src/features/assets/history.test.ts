import { describe, expect, it } from "vitest";

import {
  foldAssetValues,
  foldSingleAssetValues,
  type ValuationRow,
} from "@/features/assets/history";

const at = (day: number) => new Date(Date.UTC(2026, 5, day));

const rows = (...entries: [string, number, bigint][]): ValuationRow[] =>
  entries.map(([assetId, day, value]) => ({ assetId, asOf: at(day), value }));

describe("foldAssetValues", () => {
  it("is zero before anything has been valued", () => {
    expect(foldAssetValues(rows(["gold", 10, 100n]), [at(1), at(5)])).toEqual([0n, 0n]);
  });

  it("replaces an asset's contribution on a re-pricing rather than adding to it", () => {
    const series = foldAssetValues(
      rows(["gold", 1, 100n], ["gold", 5, 150n], ["gold", 9, 120n]),
      [at(2), at(6), at(10)],
    );

    expect(series).toEqual([100n, 150n, 120n]);
  });

  it("sums across assets, each at its own latest price", () => {
    const series = foldAssetValues(
      rows(["gold", 1, 100n], ["car", 3, 900n], ["gold", 5, 150n]),
      [at(2), at(4), at(6)],
    );

    expect(series).toEqual([100n, 1_000n, 1_050n]);
  });

  it("includes a valuation dated exactly on a point", () => {
    expect(foldAssetValues(rows(["gold", 5, 100n]), [at(5)])).toEqual([100n]);
  });

  it("carries the last value forward through points with no new rows", () => {
    expect(foldAssetValues(rows(["gold", 1, 100n]), [at(2), at(3), at(4)])).toEqual([
      100n,
      100n,
      100n,
    ]);
  });

  it("does not project a later purchase backwards (G.4)", () => {
    // The car was bought on the 8th. The 2nd must not know about it.
    const series = foldAssetValues(rows(["gold", 1, 100n], ["car", 8, 900n]), [
      at(2),
      at(9),
    ]);

    expect(series).toEqual([100n, 1_000n]);
  });

  it("is an empty series for no points", () => {
    expect(foldAssetValues(rows(["gold", 1, 100n]), [])).toEqual([]);
  });
});

describe("foldSingleAssetValues", () => {
  it("follows one asset's recorded values", () => {
    expect(
      foldSingleAssetValues(rows(["gold", 1, 100n], ["gold", 5, 150n]), [
        at(0),
        at(2),
        at(6),
      ]),
    ).toEqual([0n, 100n, 150n]);
  });
});
