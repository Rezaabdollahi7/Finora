import { describe, expect, it } from "vitest";

import {
  change,
  rank,
  savingsRate,
  shares,
  trend,
  TREND_DEAD_BAND,
  type Bucket,
} from "@/features/reports/reporting";

const toman = (value: number) => BigInt(value) * 10n;

describe("savingsRate", () => {
  it("is savings over income", () => {
    expect(savingsRate(toman(80_000_000), toman(20_000_000))).toBeCloseTo(0.25, 5);
  });

  it("goes negative for a month that spent from savings", () => {
    expect(savingsRate(toman(50_000_000), toman(-10_000_000))).toBeCloseTo(-0.2, 5);
  });

  it("is unknown rather than zero when nothing was earned", () => {
    // A household that earned nothing did not save 0% of anything.
    expect(savingsRate(0n, 0n)).toBeNull();
    expect(savingsRate(0n, toman(-5_000_000))).toBeNull();
  });

  it("keeps meaning past 2^53, where a double would round", () => {
    const huge = 9_007_199_254_740_993n;
    expect(savingsRate(huge, huge / 2n)).toBeCloseTo(0.5, 5);
  });
});

describe("change", () => {
  it("reports the absolute move and the ratio", () => {
    const moved = change(toman(120_000_000), toman(100_000_000));

    expect(moved.amount).toBe(toman(20_000_000));
    expect(moved.ratio).toBeCloseTo(0.2, 5);
  });

  it("reports a fall as a negative move", () => {
    const moved = change(toman(80_000_000), toman(100_000_000));

    expect(moved.amount).toBe(toman(-20_000_000));
    expect(moved.ratio).toBeCloseTo(-0.2, 5);
  });

  it("has no ratio when there was nothing to compare against", () => {
    // Going from nothing to something is not an infinite improvement, and
    // JSON cannot carry Infinity anyway.
    const moved = change(toman(50_000_000), 0n);

    expect(moved.amount).toBe(toman(50_000_000));
    expect(moved.ratio).toBeNull();
  });

  it("reads a debt shrinking as an improvement, not a fall", () => {
    // Net worth of −100M becoming −50M moved by +50M, which is half of the
    // magnitude it started at.
    const moved = change(toman(-50_000_000), toman(-100_000_000));

    expect(moved.amount).toBe(toman(50_000_000));
    expect(moved.ratio).toBeCloseTo(0.5, 5);
  });

  it("is flat when nothing moved", () => {
    expect(change(toman(10_000_000), toman(10_000_000))).toMatchObject({
      amount: 0n,
      ratio: 0,
    });
  });
});

describe("rank", () => {
  const bucket = (key: string, label: string, amount: number): Bucket => ({
    key,
    label,
    amount: toman(amount),
  });

  it("puts the largest first", () => {
    const ordered = rank([
      bucket("a", "خوراک", 5_000_000),
      bucket("b", "مسکن", 38_000_000),
      bucket("c", "حمل‌ونقل", 2_000_000),
    ]);

    expect(ordered.map((entry) => entry.key)).toEqual(["b", "a", "c"]);
  });

  it("breaks ties by label, so a refresh cannot reorder the report", () => {
    const ordered = rank([bucket("b", "ب", 1_000_000), bucket("a", "الف", 1_000_000)]);

    expect(ordered.map((entry) => entry.key)).toEqual(["a", "b"]);
  });

  it("does not mutate what it was handed", () => {
    const input = [bucket("a", "الف", 1), bucket("b", "ب", 9)];
    rank(input);

    expect(input.map((entry) => entry.key)).toEqual(["a", "b"]);
  });
});

describe("shares", () => {
  const bucket = (key: string, amount: number): Bucket => ({
    key,
    label: key,
    amount: toman(amount),
  });

  it("gives each bucket its share of the whole", () => {
    const result = shares([bucket("a", 75_000_000), bucket("b", 25_000_000)]);

    expect(result[0]!.share).toBeCloseTo(0.75, 5);
    expect(result[1]!.share).toBeCloseTo(0.25, 5);
  });

  it("adds up to one, because the total is the sum of the parts", () => {
    const result = shares([bucket("a", 33), bucket("b", 33), bucket("c", 34)]);
    const total = result.reduce((sum, entry) => sum + entry.share, 0);

    expect(total).toBeCloseTo(1, 4);
  });

  it("gives everything a zero share rather than dividing by nothing", () => {
    expect(shares([bucket("a", 0), bucket("b", 0)]).every((e) => e.share === 0)).toBe(
      true,
    );
    expect(shares([])).toEqual([]);
  });
});

describe("trend", () => {
  it("reports which way a figure moved", () => {
    expect(trend(toman(15_000_000), toman(10_000_000))).toBe("UP");
    expect(trend(toman(5_000_000), toman(10_000_000))).toBe("DOWN");
  });

  it("calls a small move flat, so an arrow means something", () => {
    expect(TREND_DEAD_BAND).toBe(0.05);
    // 4% either way is noise; 6% is a move.
    expect(trend(toman(10_400_000), toman(10_000_000))).toBe("FLAT");
    expect(trend(toman(10_600_000), toman(10_000_000))).toBe("UP");
    expect(trend(toman(9_400_000), toman(10_000_000))).toBe("DOWN");
  });

  it("treats a category that is new this month as up, not flat", () => {
    expect(trend(toman(3_000_000), 0n)).toBe("UP");
  });

  it("is flat when there was nothing before and nothing now", () => {
    expect(trend(0n, 0n)).toBe("FLAT");
  });

  it("carries no judgement, only a direction", () => {
    // Task 8.8: factual observations, never a score. UP for spending and UP
    // for income are the same value; nothing here knows which is good.
    expect(new Set(["UP", "DOWN", "FLAT"]).has(trend(1n, 2n))).toBe(true);
  });
});
