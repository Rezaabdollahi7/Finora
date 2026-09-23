import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { resetLedger } from "@test/reset";
import { fromJalaliDate } from "@/utils/date";
import {
  createContributionSchema,
  createGoalSchema,
  goalFiltersSchema,
  updateGoalSchema,
} from "@/features/goals/schemas";
import {
  addContribution,
  archiveGoal,
  completeGoal,
  createGoal,
  getGoal,
  listGoals,
  removeContribution,
  reopenGoal,
  restoreGoal,
  updateGoal,
} from "@/features/goals/server/goal-service";

/** Tasks 6.1–6.5, against a real PostgreSQL database. */

const jalali = (year: number, month: number, day: number) =>
  fromJalaliDate({ year, month, day });

const NOW = jalali(1405, 6, 20);
const defaults = goalFiltersSchema.parse({});

const goalInput = (overrides: Record<string, unknown> = {}) =>
  createGoalSchema.parse({
    name: "پس‌انداز اضطراری",
    kind: "EMERGENCY",
    targetAmount: "100,000,000",
    owner: "SHARED",
    ...overrides,
  });

const contribution = (amount: string, overrides: Record<string, unknown> = {}) =>
  createContributionSchema.parse({
    amount,
    date: jalali(1405, 6, 5).toISOString(),
    ...overrides,
  });

beforeEach(async () => {
  await resetLedger();
});

describe("creating and reading a goal", () => {
  it("starts at nothing saved and nothing reached", async () => {
    const goal = await createGoal(goalInput(), NOW);

    expect(goal.progress).toMatchObject({
      targetAmount: "1000000000",
      currentAmount: "0",
      remainingAmount: "1000000000",
      isReached: false,
      state: "IN_PROGRESS",
    });
    expect(goal.status).toBe("ACTIVE");
    expect(goal.contributions).toEqual([]);
  });

  it("derives what is saved from the contributions, with no stored total", async () => {
    const goal = await createGoal(goalInput(), NOW);

    await addContribution(goal.id, contribution("30,000,000"), NOW);
    const after = await addContribution(goal.id, contribution("15,000,000"), NOW);

    expect(after.progress.currentAmount).toBe("450000000");
    expect(after.progress.ratio).toBeCloseTo(0.45, 5);

    // There is no column to drift; the row itself knows only the target.
    const row = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(Object.keys(row)).not.toContain("currentAmount");
  });

  it("puts the soonest deadline first and an open-ended goal last", async () => {
    await createGoal(goalInput({ name: "بی‌مهلت" }), NOW);
    await createGoal(
      goalInput({ name: "اسفند", targetDate: jalali(1405, 12, 1).toISOString() }),
      NOW,
    );
    await createGoal(
      goalInput({ name: "مهر", targetDate: jalali(1405, 7, 1).toISOString() }),
      NOW,
    );

    expect((await listGoals(defaults, NOW)).map((goal) => goal.name)).toEqual([
      "مهر",
      "اسفند",
      "بی‌مهلت",
    ]);
  });
});

describe("contributions", () => {
  it("never writes a transaction, so saving is not spending", async () => {
    const goal = await createGoal(goalInput(), NOW);

    await addContribution(goal.id, contribution("30,000,000"), NOW);

    // Rule G.3's reasoning: money set aside has not left the household.
    expect(await prisma.transaction.count()).toBe(0);
  });

  it("nets a withdrawal out rather than deleting the contribution", async () => {
    const goal = await createGoal(goalInput(), NOW);

    await addContribution(goal.id, contribution("50,000,000"), NOW);
    const after = await addContribution(
      goal.id,
      contribution("20,000,000", { isWithdrawal: true }),
      NOW,
    );

    expect(after.progress.currentAmount).toBe("300000000");
    // Both rows survive: the history says what actually happened.
    expect(after.contributions).toHaveLength(2);
  });

  it("follows the sum back down when one is removed", async () => {
    const goal = await createGoal(goalInput(), NOW);
    const withOne = await addContribution(goal.id, contribution("30,000,000"), NOW);

    const after = await removeContribution(goal.id, withOne.contributions[0]!.id, NOW);

    expect(after.progress.currentAmount).toBe("0");
  });

  it("refuses to add to an archived goal", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await archiveGoal(goal.id, NOW);

    await expect(
      addContribution(goal.id, contribution("1,000,000"), NOW),
    ).rejects.toThrow();
  });
});

describe("status", () => {
  it("completes a goal on its own once the target is reached", async () => {
    const goal = await createGoal(goalInput(), NOW);

    const after = await addContribution(goal.id, contribution("100,000,000"), NOW);

    expect(after.status).toBe("COMPLETED");
    expect(after.progress.state).toBe("REACHED");
  });

  it("keeps a goal completed by hand below its target", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await addContribution(goal.id, contribution("80,000,000"), NOW);
    await completeGoal(goal.id, NOW);

    // The household decided this one was enough. A later contribution must
    // not silently undo that decision.
    const after = await addContribution(goal.id, contribution("1,000,000"), NOW);

    expect(after.status).toBe("COMPLETED");
  });

  it("stays completed after a withdrawal, until someone reopens it", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await addContribution(goal.id, contribution("100,000,000"), NOW);

    const after = await addContribution(
      goal.id,
      contribution("40,000,000", { isWithdrawal: true }),
      NOW,
    );

    expect(after.status).toBe("COMPLETED");
    // The bar tells the truth even while the status does not.
    expect(after.progress.isReached).toBe(false);
    expect(after.progress.currentAmount).toBe("600000000");

    expect((await reopenGoal(goal.id, NOW)).status).toBe("ACTIVE");
  });

  it("raising the target of a reached goal leaves the money alone", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await addContribution(goal.id, contribution("100,000,000"), NOW);

    const after = await updateGoal(
      goal.id,
      updateGoalSchema.parse({ targetAmount: "150,000,000" }),
      NOW,
    );

    // Rule G.4: what went in is what went in.
    expect(after.progress.currentAmount).toBe("1000000000");
    expect(after.progress.remainingAmount).toBe("500000000");
  });

  it("hides an archived goal from the list but keeps its history", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await addContribution(goal.id, contribution("30,000,000"), NOW);
    await archiveGoal(goal.id, NOW);

    expect(await listGoals(defaults, NOW)).toEqual([]);
    expect(
      (await listGoals(goalFiltersSchema.parse({ includeArchived: true }), NOW)).map(
        (entry) => entry.name,
      ),
    ).toEqual([goal.name]);

    expect((await getGoal(goal.id, NOW))!.progress.currentAmount).toBe("300000000");
  });

  it("really comes back out of the archive", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await archiveGoal(goal.id, NOW);

    // The loan version of this shipped doing nothing at all, because the
    // sync it delegated to deliberately skips archived rows.
    expect((await restoreGoal(goal.id, NOW)).status).toBe("ACTIVE");
  });

  it("completes a restored goal that had already reached its target", async () => {
    const goal = await createGoal(goalInput(), NOW);
    await addContribution(goal.id, contribution("100,000,000"), NOW);
    await archiveGoal(goal.id, NOW);

    expect((await restoreGoal(goal.id, NOW)).status).toBe("COMPLETED");
  });

  it("refuses the operations that make no sense from where the goal is", async () => {
    const goal = await createGoal(goalInput(), NOW);

    await expect(restoreGoal(goal.id, NOW)).rejects.toThrow();
    await expect(reopenGoal(goal.id, NOW)).rejects.toThrow();

    await archiveGoal(goal.id, NOW);
    await expect(archiveGoal(goal.id, NOW)).rejects.toThrow();
    await expect(completeGoal(goal.id, NOW)).rejects.toThrow();
  });
});

describe("what it needs each month", () => {
  it("spreads the remainder over the months to the deadline", async () => {
    const goal = await createGoal(
      goalInput({ targetDate: jalali(1405, 12, 29).toISOString() }),
      NOW,
    );

    await addContribution(goal.id, contribution("30,000,000"), NOW);

    const after = (await getGoal(goal.id, NOW))!;

    // 70,000,000 Toman over the seven months Shahrivar–Esfand, rounded up.
    expect(after.progress.monthsRemaining).toBe(7);
    expect(after.progress.monthlyContribution).toBe("100000000");
  });

  it("says nothing per month for a goal with no deadline", async () => {
    const goal = await createGoal(goalInput(), NOW);

    expect((await getGoal(goal.id, NOW))!.progress.monthlyContribution).toBeNull();
  });
});
