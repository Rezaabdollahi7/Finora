import { describe, expect, it } from "vitest";

import { absoluteJalaliMonth, fromJalaliDate, jalaliMonthOf } from "@/utils/date";
import { goalProgress, monthsUntil } from "@/features/goals/progress";

/** The same calendar the service passes in. */
const monthOf = (instant: Date) => absoluteJalaliMonth(jalaliMonthOf(instant));

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

/** A moment inside Shahrivar 1405. */
const NOW = jalali(1405, 6, 20);

const toman = (value: number) => BigInt(value) * 10n;

const TARGET = toman(100_000_000);

const put = (...amounts: number[]) =>
  amounts.map((amount) => ({ amount: toman(amount), isWithdrawal: false }));

const took = (amount: number) => ({ amount: toman(amount), isWithdrawal: true });

describe("monthsUntil", () => {
  it("counts the month in progress, because money can still go in it", () => {
    // Esfand is six months after Shahrivar; seven months can still take money.
    expect(monthsUntil(jalali(1405, 12, 29), NOW, monthOf)).toBe(7);
  });

  it("gives one for a date inside this month", () => {
    expect(monthsUntil(jalali(1405, 6, 31), NOW, monthOf)).toBe(1);
    expect(monthsUntil(jalali(1405, 6, 1), NOW, monthOf)).toBe(1);
  });

  it("gives zero once the month has passed, never a negative", () => {
    expect(monthsUntil(jalali(1405, 5, 1), NOW, monthOf)).toBe(0);
    expect(monthsUntil(jalali(1403, 1, 1), NOW, monthOf)).toBe(0);
  });

  it("crosses the new year without arithmetic of its own", () => {
    expect(monthsUntil(jalali(1406, 1, 1), NOW, monthOf)).toBe(8);
  });
});

describe("goalProgress", () => {
  const progress = (
    contributions: { amount: bigint; isWithdrawal: boolean }[],
    targetDate: Date | null = null,
    targetAmount = TARGET,
  ) => goalProgress({ targetAmount, targetDate, contributions }, NOW, monthOf);

  it("reports target, current, remaining and the share reached", () => {
    const result = progress(put(30_000_000, 15_000_000));

    expect(result.currentAmount).toBe(toman(45_000_000));
    expect(result.remainingAmount).toBe(toman(55_000_000));
    expect(result.ratio).toBeCloseTo(0.45, 5);
    expect(result.isReached).toBe(false);
    expect(result.state).toBe("IN_PROGRESS");
  });

  it("nets a withdrawal out of the total rather than hiding it", () => {
    expect(progress([...put(50_000_000), took(20_000_000)]).currentAmount).toBe(
      toman(30_000_000),
    );
  });

  it("never reports less than nothing saved", () => {
    // Taking out more than went in is a data-entry slip, not negative saving,
    // and a bar drawn from it would point the wrong way.
    expect(progress([...put(10_000_000), took(30_000_000)]).currentAmount).toBe(0n);
    expect(progress([...put(10_000_000), took(30_000_000)]).ratio).toBe(0);
  });

  it("caps the share at one and the remainder at zero once reached", () => {
    const result = progress(put(120_000_000));

    expect(result.isReached).toBe(true);
    expect(result.remainingAmount).toBe(0n);
    expect(result.ratio).toBe(1);
    expect(result.state).toBe("REACHED");
  });

  it("keeps whole Rial past 2^53, where a double would round", () => {
    const huge = 9_007_199_254_740_993n;
    const result = goalProgress(
      {
        targetAmount: huge,
        targetDate: null,
        contributions: [{ amount: huge - 1n, isWithdrawal: false }],
      },
      NOW,
      monthOf,
    );

    expect(result.remainingAmount).toBe(1n);
    expect(result.isReached).toBe(false);
  });

  describe("the monthly contribution it needs", () => {
    it("spreads what is left over the months that are left", () => {
      // 55M over the seven months from Shahrivar to Esfand inclusive.
      const result = progress(put(45_000_000), jalali(1405, 12, 29));

      expect(result.monthsRemaining).toBe(7);
      expect(result.monthlyContribution).toBe(toman(55_000_000) / 7n + 1n);
    });

    it("rounds up, so the last month is not a Rial short", () => {
      const result = goalProgress(
        { targetAmount: 10n, targetDate: jalali(1405, 8, 1), contributions: [] },
        NOW,
        monthOf,
      );

      // 10 Rial over 3 months is 3.33; rounding down would land on 9.
      expect(result.monthsRemaining).toBe(3);
      expect(result.monthlyContribution).toBe(4n);
    });

    it("is nothing once the goal is reached", () => {
      expect(progress(put(100_000_000), jalali(1405, 12, 29)).monthlyContribution).toBe(
        0n,
      );
    });

    it("is the whole remainder once the date has passed, not a monthly figure", () => {
      const result = progress(put(45_000_000), jalali(1405, 4, 1));

      expect(result.state).toBe("OVERDUE");
      expect(result.monthlyContribution).toBe(toman(55_000_000));
    });

    it("is null for a goal with no deadline, rather than a made-up one", () => {
      const result = progress(put(45_000_000));

      expect(result.monthsRemaining).toBeNull();
      expect(result.monthlyContribution).toBeNull();
      // No deadline is not an overdue deadline.
      expect(result.state).toBe("IN_PROGRESS");
    });

    it("says reached rather than overdue for a goal met after its date", () => {
      expect(progress(put(100_000_000), jalali(1405, 4, 1)).state).toBe("REACHED");
    });
  });

  it("starts a fresh goal at nothing without dividing by zero", () => {
    const result = progress([]);

    expect(result.currentAmount).toBe(0n);
    expect(result.ratio).toBe(0);
    expect(result.remainingAmount).toBe(TARGET);
  });
});
