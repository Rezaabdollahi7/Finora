import { describe, expect, it } from "vitest";

import { fromJalaliDate } from "@/utils/date";
import { loanProgress, type ProgressInput } from "@/features/loans/progress";

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const NOW = jalali(1405, 9, 10);

/** Six monthly instalments of 4,100,000 Toman, the first four paid. */
function schedule(paidCount: number): ProgressInput[] {
  return Array.from({ length: 6 }, (_, index) => ({
    dueDate: jalali(1405, 6 + index, 5),
    paidAt: index < paidCount ? jalali(1405, 6 + index, 5) : null,
    amount: 41_000_000n,
  }));
}

describe("loanProgress", () => {
  it("counts paid, remaining and total instalments", () => {
    expect(loanProgress(schedule(4), NOW)).toMatchObject({
      total: 6,
      paid: 4,
      remaining: 2,
    });
  });

  it("totals what has been paid and what is still owed", () => {
    const progress = loanProgress(schedule(4), NOW);

    expect(progress.paidAmount).toBe("164000000");
    expect(progress.remainingAmount).toBe("82000000");
    expect(progress.totalAmount).toBe("246000000");
  });

  it("reports the share paid, for the progress bar", () => {
    expect(loanProgress(schedule(4), NOW).ratio).toBeCloseTo(4 / 6, 10);
  });

  it("counts an unpaid instalment whose date has passed as overdue", () => {
    // Four due dates sit behind 10 Azar — Shahrivar, Mehr, Aban and the 5th
    // of Azar itself. Two of them are paid, so two are overdue.
    const progress = loanProgress(schedule(2), NOW);

    expect(progress.overdue).toBe(2);
    expect(progress.overdueAmount).toBe("82000000");
    // Overdue instalments are still owed, so they are part of what remains.
    expect(progress.remainingAmount).toBe("164000000");
  });

  it("does not count a future instalment as overdue", () => {
    expect(loanProgress(schedule(6), NOW).overdue).toBe(0);
  });

  it("points at the soonest unpaid instalment", () => {
    const progress = loanProgress(schedule(4), NOW);
    expect(progress.nextDueDate).toBe(jalali(1405, 10, 5).toISOString());
  });

  it("finds the soonest even when the instalments arrive out of order", () => {
    const shuffled = [...schedule(0)].reverse();
    expect(loanProgress(shuffled, NOW).nextDueDate).toBe(
      jalali(1405, 6, 5).toISOString(),
    );
  });

  it("has no next due date once everything is paid", () => {
    const progress = loanProgress(schedule(6), NOW);

    expect(progress.nextDueDate).toBeNull();
    expect(progress.isSettled).toBe(true);
    expect(progress.remainingAmount).toBe("0");
  });

  it("is not settled while anything is left", () => {
    expect(loanProgress(schedule(5), NOW).isSettled).toBe(false);
  });

  it("is not settled when there is no schedule at all", () => {
    // Nothing paid off here — there was never anything to pay.
    expect(loanProgress([], NOW)).toMatchObject({
      total: 0,
      paid: 0,
      remaining: 0,
      ratio: 0,
      isSettled: false,
      totalAmount: "0",
      nextDueDate: null,
    });
  });

  it("stays exact at amounts a float would round", () => {
    const huge: ProgressInput[] = [
      {
        dueDate: jalali(1405, 6, 5),
        paidAt: jalali(1405, 6, 5),
        amount: 9_007_199_254_740_993n,
      },
      { dueDate: jalali(1405, 7, 5), paidAt: null, amount: 9_007_199_254_740_993n },
    ];

    const progress = loanProgress(huge, NOW);

    expect(progress.paidAmount).toBe("9007199254740993");
    expect(progress.totalAmount).toBe("18014398509481986");
  });
});
