import { describe, expect, it } from "vitest";

import {
  budgetAlerts,
  budgetMonth,
  budgetState,
  foldRollover,
  WARNING_RATIO,
} from "@/features/budgets/tracking";

/** Toman, as whole Rial. The roadmap's own example budgets are in millions. */
const toman = (value: number) => BigInt(value) * 10n;

const FOOD = toman(25_000_000);

describe("budgetState", () => {
  it("is normal below the warning threshold", () => {
    expect(budgetState(FOOD, toman(18_500_000))).toBe("NORMAL");
  });

  it("warns from eighty per cent, which is where the roadmap puts it", () => {
    expect(WARNING_RATIO).toBe(0.8);
    expect(budgetState(FOOD, toman(19_999_999))).toBe("NORMAL");
    expect(budgetState(FOOD, toman(20_000_000))).toBe("WARNING");
  });

  it("treats a budget spent to its last Rial as at the limit, not over it", () => {
    expect(budgetState(FOOD, FOOD)).toBe("WARNING");
    expect(budgetState(FOOD, FOOD + 1n)).toBe("OVER");
  });

  it("is over the moment anything is spent against nothing", () => {
    expect(budgetState(0n, 0n)).toBe("NORMAL");
    expect(budgetState(0n, 1n)).toBe("OVER");
  });
});

describe("budgetMonth", () => {
  it("reports budget, spent, remaining and the share used", () => {
    const month = budgetMonth(FOOD, toman(18_500_000));

    expect(month.available).toBe(FOOD);
    expect(month.spent).toBe(toman(18_500_000));
    expect(month.remaining).toBe(toman(6_500_000));
    expect(month.ratio).toBeCloseTo(0.74, 5);
    expect(month.state).toBe("NORMAL");
  });

  it("reports a negative remainder rather than clamping it to zero", () => {
    // What the household is over by is the number it has to find.
    expect(budgetMonth(FOOD, toman(28_000_000)).remaining).toBe(toman(-3_000_000));
  });

  it("keeps whole Rial past 2^53, where a double would round", () => {
    const huge = 9_007_199_254_740_993n;
    const month = budgetMonth(huge, huge - 1n);

    expect(month.remaining).toBe(1n);
    expect(month.state).toBe("WARNING");
  });

  it("gives a drawable proportion rather than Infinity for a zero budget", () => {
    const month = budgetMonth(0n, toman(500_000));

    expect(Number.isFinite(month.ratio)).toBe(true);
    expect(month.ratio).toBe(1);
    expect(month.state).toBe("OVER");
    // The real figures are still exact beside it.
    expect(month.remaining).toBe(toman(-500_000));
  });
});

describe("foldRollover", () => {
  const months = (spends: bigint[], amount = FOOD) =>
    spends.map((spent, index) => ({ month: index, amount, spent }));

  it("carries an unused remainder into the next month", () => {
    const [first, second] = foldRollover(
      months([toman(20_000_000), toman(26_000_000)]),
      { rollover: true },
    );

    expect(first!.carriedIn).toBe(0n);
    expect(second!.carriedIn).toBe(toman(5_000_000));
    expect(second!.available).toBe(toman(30_000_000));
    // 26M against 30M available is inside budget; against 25M it would not be.
    expect(second!.state).toBe("WARNING");
    expect(second!.remaining).toBe(toman(4_000_000));
  });

  it("carries nothing when rollover is off", () => {
    const [, second] = foldRollover(months([toman(20_000_000), toman(26_000_000)]), {
      rollover: false,
    });

    expect(second!.carriedIn).toBe(0n);
    expect(second!.available).toBe(FOOD);
    expect(second!.state).toBe("OVER");
  });

  it("never carries a deficit forward as a debt", () => {
    const [first, second] = foldRollover(
      months([toman(30_000_000), toman(10_000_000)]),
      { rollover: true },
    );

    expect(first!.remaining).toBe(toman(-5_000_000));
    expect(second!.carriedIn).toBe(0n);
    expect(second!.available).toBe(FOOD);
  });

  it("accumulates a surplus across several quiet months", () => {
    const folded = foldRollover(
      months([toman(20_000_000), toman(20_000_000), toman(20_000_000)]),
      { rollover: true },
    );

    expect(folded[2]!.carriedIn).toBe(toman(10_000_000));
    expect(folded[2]!.available).toBe(toman(35_000_000));
  });

  it("resets the month's own limit every month, carry aside", () => {
    // The budget is per month; rollover adds to it, it does not replace it.
    const folded = foldRollover(months([FOOD, toman(1_000_000)]), { rollover: true });

    expect(folded[0]!.remaining).toBe(0n);
    expect(folded[1]!.amount).toBe(FOOD);
    expect(folded[1]!.carriedIn).toBe(0n);
  });

  it("returns nothing for no months rather than throwing", () => {
    expect(foldRollover([], { rollover: true })).toEqual([]);
  });
});

describe("budgetAlerts", () => {
  const cash = { availableBalance: toman(100_000_000), upcomingObligations: 0n };

  const line = (id: string, amount: bigint, spent: bigint) => ({
    categoryId: id,
    categoryName: id,
    month: budgetMonth(amount, spent),
  });

  it("raises one alert for a budget past eighty per cent", () => {
    const alerts = budgetAlerts([line("food", FOOD, toman(21_000_000))], cash);

    expect(alerts).toEqual([
      {
        kind: "NEAR_LIMIT",
        categoryId: "food",
        categoryName: "food",
        // What is left, which is the figure that has to last the month.
        amount: toman(4_000_000),
      },
    ]);
  });

  it("raises one alert for a budget past its limit, not two", () => {
    const alerts = budgetAlerts([line("food", FOOD, toman(28_000_000))], cash);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "OVER_BUDGET",
      // How far past, which is the figure that needs covering.
      amount: toman(3_000_000),
    });
  });

  it("says nothing about a budget that is comfortable", () => {
    expect(budgetAlerts([line("food", FOOD, toman(1_000_000))], cash)).toEqual([]);
  });

  it("warns when the payments due exceed what the accounts hold", () => {
    const alerts = budgetAlerts([], {
      availableBalance: toman(5_000_000),
      upcomingObligations: toman(12_000_000),
    });

    expect(alerts).toEqual([
      {
        kind: "CASH_SHORTFALL",
        categoryId: null,
        categoryName: null,
        amount: toman(7_000_000),
      },
    ]);
  });

  it("says nothing when the accounts cover what is due to the last Rial", () => {
    expect(
      budgetAlerts([], {
        availableBalance: toman(12_000_000),
        upcomingObligations: toman(12_000_000),
      }),
    ).toEqual([]);
  });

  it("reports a cash shortfall even when every budget is inside its limit", () => {
    const alerts = budgetAlerts([line("food", FOOD, toman(1_000_000))], {
      availableBalance: 0n,
      upcomingObligations: toman(45_000_000),
    });

    expect(alerts.map((alert) => alert.kind)).toEqual(["CASH_SHORTFALL"]);
  });
});
