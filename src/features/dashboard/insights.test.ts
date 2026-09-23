import { describe, expect, it } from "vitest";

import {
  incomeSplit,
  isGoodChange,
  monthOverMonth,
  monthPace,
  netWorthComposition,
  ratioOf,
  segmentWidths,
} from "./insights";
import type { DashboardTotals } from "./types";

const totals = (overrides: Partial<DashboardTotals> = {}): DashboardTotals => ({
  totalBalance: "0",
  monthlyIncome: "0",
  monthlyExpenses: "0",
  monthlySavings: "0",
  assetValue: "0",
  liabilityValue: "0",
  netWorth: "0",
  ...overrides,
});

describe("ratioOf", () => {
  it("divides without losing precision on amounts past 2^53", () => {
    // Nine quadrillion Rial against three times that: exact thirds.
    const whole = 27_000_000_000_000_000n;
    expect(ratioOf(whole / 3n, whole)).toBeCloseTo(1 / 3, 6);
  });

  it("is 0 when the whole is 0", () => {
    expect(ratioOf(5n, 0n)).toBe(0);
  });
});

describe("monthOverMonth", () => {
  it("has nothing to say without a previous figure", () => {
    expect(monthOverMonth("1000", "0")).toBeNull();
  });

  it("reports a flat month", () => {
    expect(monthOverMonth("1000", "1000")).toEqual({ direction: "flat", ratio: 0 });
  });

  it("measures a rise and a fall against the previous month", () => {
    expect(monthOverMonth("1500", "1000")).toEqual({ direction: "up", ratio: 0.5 });
    expect(monthOverMonth("750", "1000")).toEqual({ direction: "down", ratio: 0.25 });
  });

  it("measures against the size of a negative previous figure", () => {
    // Savings went from −1,000 to +1,000: a rise of twice last month's size.
    expect(monthOverMonth("1000", "-1000")).toEqual({ direction: "up", ratio: 2 });
  });
});

describe("isGoodChange", () => {
  it("judges by the metric, not the direction", () => {
    expect(isGoodChange({ direction: "down", ratio: 0.1 }, "down")).toBe(true);
    expect(isGoodChange({ direction: "down", ratio: 0.1 }, "up")).toBe(false);
    expect(isGoodChange({ direction: "up", ratio: 0.1 }, "up")).toBe(true);
  });

  it("passes no judgement on a flat month or a neutral metric", () => {
    expect(isGoodChange({ direction: "flat", ratio: 0 }, "up")).toBeNull();
    expect(isGoodChange({ direction: "up", ratio: 0.1 }, "either")).toBeNull();
  });
});

describe("incomeSplit", () => {
  it("is empty when nothing moved", () => {
    expect(incomeSplit("0", "0")).toEqual({ kind: "empty" });
  });

  it("is all deficit when spending without income", () => {
    expect(incomeSplit("0", "5000")).toEqual({ kind: "no-income", expenses: 5000n });
  });

  it("splits income into spent and saved shares that sum to one", () => {
    const split = incomeSplit("40000000", "30000000");

    expect(split).toEqual({ kind: "surplus", expenseShare: 0.75, savingsShare: 0.25 });
  });

  it("reports overspending as a share of income, with the exact deficit", () => {
    expect(incomeSplit("40000000", "50000000")).toEqual({
      kind: "deficit",
      overspend: 0.25,
      deficit: 10_000_000n,
    });
  });

  it("treats spending exactly the income as a surplus with nothing saved", () => {
    expect(incomeSplit("1000", "1000")).toEqual({
      kind: "surplus",
      expenseShare: 1,
      savingsShare: 0,
    });
  });
});

describe("monthPace", () => {
  // Mehr 1405: 1 Mehr is 2026-09-23 in Tehran, which starts at 20:30 UTC
  // the evening before. Mehr has 30 days.
  const mehr = { start: "2026-09-22T20:30:00.000Z", end: "2026-10-22T20:30:00.000Z" };

  it("counts the first day of the month from Tehran midnight, not UTC", () => {
    // 22:00 UTC on 22 September is already 1 Mehr in Tehran.
    const pace = monthPace(mehr, "0", new Date("2026-09-22T22:00:00Z"));

    expect(pace).toMatchObject({ day: 1, length: 30, remainingDays: 30 });
  });

  it("spreads what is left over the remaining days, today included", () => {
    // 10 Mehr: 21 days left including today.
    const pace = monthPace(mehr, "21000000", new Date("2026-10-02T08:00:00Z"));

    expect(pace.day).toBe(10);
    expect(pace.remainingDays).toBe(21);
    expect(pace.perDay).toBe(1_000_000n);
    expect(pace.progress).toBeCloseTo(10 / 30, 6);
  });

  it("rounds the daily figure down to a whole Toman", () => {
    // 42,460,000 Toman over 30 days is 1,415,333.33 Toman a day.
    const pace = monthPace(mehr, "424600000", new Date("2026-09-23T08:00:00Z"));

    expect(pace.perDay).toBe(14_153_330n);
    expect(pace.perDay % 10n).toBe(0n);
  });

  it("has nothing to spread when the month is in deficit", () => {
    const pace = monthPace(mehr, "-5000", new Date("2026-09-23T08:00:00Z"));

    expect(pace.left).toBe(-5000n);
    expect(pace.perDay).toBe(0n);
  });

  it("stays inside the month at its last day", () => {
    const pace = monthPace(mehr, "0", new Date("2026-10-22T19:00:00Z"));

    expect(pace).toMatchObject({ day: 30, remainingDays: 1, progress: 1 });
  });
});

describe("netWorthComposition", () => {
  it("splits what the household has between accounts and assets", () => {
    const composition = netWorthComposition(
      totals({ totalBalance: "300", assetValue: "700", liabilityValue: "250" }),
    );

    expect(composition).toMatchObject({
      gross: 1000n,
      balanceShare: 0.3,
      assetShare: 0.7,
      liabilityShare: 0.25,
    });
  });

  it("gives an overdrawn balance no share of the bar", () => {
    const composition = netWorthComposition(
      totals({ totalBalance: "-500", assetValue: "1000" }),
    );

    expect(composition.balance).toBe(0n);
    expect(composition.assetShare).toBe(1);
  });

  it("caps liabilities at the full bar when they exceed everything owned", () => {
    expect(
      netWorthComposition(totals({ assetValue: "100", liabilityValue: "900" }))
        .liabilityShare,
    ).toBe(1);
    expect(netWorthComposition(totals({ liabilityValue: "900" })).liabilityShare).toBe(
      1,
    );
  });
});

describe("segmentWidths", () => {
  const sum = (widths: number[]) => widths.reduce((total, width) => total + width, 0);

  it("returns proportional widths that fill the bar", () => {
    expect(segmentWidths([0.25, 0.75])).toEqual([25, 75]);
  });

  it("gives a tiny share a visible minimum without overflowing", () => {
    const widths = segmentWidths([0.995, 0.005], 2);

    expect(widths[1]).toBe(2);
    expect(sum(widths)).toBeCloseTo(100, 6);
  });

  it("leaves empty segments empty", () => {
    const widths = segmentWidths([0.5, 0, 0.5]);

    expect(widths).toEqual([50, 0, 50]);
  });

  it("draws nothing when every share is zero", () => {
    expect(segmentWidths([0, 0])).toEqual([0, 0]);
  });
});
