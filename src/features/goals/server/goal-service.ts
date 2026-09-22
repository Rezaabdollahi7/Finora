import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { GoalContributionModel, GoalModel } from "@/generated/prisma/models";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { absoluteJalaliMonth, jalaliMonthOf } from "@/utils/date";
import { goalProgress } from "@/features/goals/progress";
import type {
  CreateContributionInput,
  CreateGoalInput,
  GoalFilters,
  UpdateGoalInput,
} from "@/features/goals/schemas";
import type {
  GoalContributionDto,
  GoalDetailDto,
  GoalDto,
} from "@/features/goals/types";

/**
 * Goal data access and business rules (tasks 6.1–6.5).
 *
 * The arithmetic is in `progress.ts` and has no database; this file is what
 * joins it to the rows.
 *
 * What a goal holds is the **sum of its contributions**, never a column. A
 * stored figure drifts the moment one is edited, removed or back-dated,
 * which is the same reasoning that keeps Account without a balance.
 */

type GoalRow = GoalModel & { contributions: GoalContributionModel[] };

const withContributions = {
  contributions: { orderBy: { date: "desc" } },
} satisfies Prisma.GoalInclude;

/** The Jalali month an instant falls in, as one comparable integer. */
function monthOf(instant: Date): number {
  return absoluteJalaliMonth(jalaliMonthOf(instant));
}

function toDto(goal: GoalRow, now: Date): GoalDto {
  const progress = goalProgress(
    {
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      contributions: goal.contributions,
    },
    now,
    monthOf,
  );

  return {
    id: goal.id,
    name: goal.name,
    kind: goal.kind,
    owner: goal.owner,
    status: goal.status,
    icon: goal.icon,
    notes: goal.notes,
    targetDate: goal.targetDate?.toISOString() ?? null,
    progress: {
      targetAmount: progress.targetAmount.toString(),
      currentAmount: progress.currentAmount.toString(),
      remainingAmount: progress.remainingAmount.toString(),
      ratio: progress.ratio,
      isReached: progress.isReached,
      monthsRemaining: progress.monthsRemaining,
      monthlyContribution: progress.monthlyContribution?.toString() ?? null,
      state: progress.state,
    },
    contributionCount: goal.contributions.length,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

function toContributionDto(row: GoalContributionModel): GoalContributionDto {
  return {
    id: row.id,
    goalId: row.goalId,
    amount: row.amount.toString(),
    isWithdrawal: row.isWithdrawal,
    date: row.date.toISOString(),
    note: row.note,
  };
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

export async function listGoals(
  filters: GoalFilters,
  now: Date = new Date(),
): Promise<GoalDto[]> {
  const goals = await prisma.goal.findMany({
    where: {
      ...(filters.status
        ? { status: filters.status }
        : filters.includeArchived
          ? {}
          : { status: { not: "ARCHIVED" } }),
      ...(filters.owner ? { owner: filters.owner } : {}),
    },
    include: withContributions,
    // Active first, then the soonest deadline: what needs money next leads.
    // A goal with no date sorts last rather than first, which is what
    // `nulls: "last"` is for — otherwise an open-ended goal would outrank
    // one due next month.
    orderBy: [{ status: "asc" }, { targetDate: { sort: "asc", nulls: "last" } }],
  });

  return goals.map((goal) => toDto(goal, now));
}

export async function getGoal(
  id: string,
  now: Date = new Date(),
): Promise<GoalDetailDto | null> {
  const goal = await prisma.goal.findUnique({
    where: { id },
    include: withContributions,
  });

  if (!goal) return null;

  return {
    ...toDto(goal, now),
    contributions: goal.contributions.map(toContributionDto),
  };
}

/* -------------------------------------------------------------------------
 * Writes (task 6.2)
 * ---------------------------------------------------------------------- */

export async function createGoal(
  input: CreateGoalInput,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const goal = await prisma.goal.create({
    data: {
      name: input.name,
      kind: input.kind,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate,
      owner: input.owner,
      icon: input.icon,
      notes: input.notes,
    },
  });

  return (await getGoal(goal.id, now))!;
}

/**
 * Edit a goal.
 *
 * Lowering the target does not touch the contributions: the money that went
 * in is what went in, and a goal that is suddenly reached because its target
 * moved is reached (rule G.4). Only `syncStatus` decides what that means.
 */
export async function updateGoal(
  id: string,
  input: UpdateGoalInput,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  await requireGoal(id);

  await prisma.goal.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.targetAmount === undefined ? {} : { targetAmount: input.targetAmount }),
      ...(input.targetDate === undefined ? {} : { targetDate: input.targetDate }),
      ...(input.owner === undefined ? {} : { owner: input.owner }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    },
  });

  await syncStatus(id);

  return (await getGoal(id, now))!;
}

export async function archiveGoal(
  id: string,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const goal = await requireGoal(id);

  if (goal.status === "ARCHIVED") {
    throw new ConflictError("این هدف از قبل بایگانی شده است.", "ALREADY_ARCHIVED");
  }

  await prisma.goal.update({ where: { id }, data: { status: "ARCHIVED" } });

  return (await getGoal(id, now))!;
}

/**
 * Bring a goal back out of the archive.
 *
 * Sets ACTIVE first and then syncs, because `syncStatus` deliberately leaves
 * an archived goal alone — without the first step this would do nothing at
 * all, which is the bug the loan version of this shipped with.
 */
export async function restoreGoal(
  id: string,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const goal = await requireGoal(id);

  if (goal.status !== "ARCHIVED") {
    throw new ConflictError("این هدف بایگانی نشده است.", "NOT_ARCHIVED");
  }

  await prisma.goal.update({ where: { id }, data: { status: "ACTIVE" } });
  await syncStatus(id);

  return (await getGoal(id, now))!;
}

/**
 * Mark a goal finished by hand (task 6.2).
 *
 * Separate from reaching the target, because the two are different claims. A
 * household that decides the holiday fund is enough at 80% is finished with
 * it; a goal that reaches its target is completed by `syncStatus` on its
 * own. Either way the contributions are untouched.
 */
export async function completeGoal(
  id: string,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const goal = await requireGoal(id);

  if (goal.status === "COMPLETED") {
    throw new ConflictError("این هدف از قبل تکمیل شده است.", "ALREADY_COMPLETED");
  }

  if (goal.status === "ARCHIVED") {
    throw new ConflictError("هدف بایگانی‌شده را نمی‌توان تکمیل کرد.", "GOAL_ARCHIVED");
  }

  await prisma.goal.update({ where: { id }, data: { status: "COMPLETED" } });

  return (await getGoal(id, now))!;
}

/**
 * Reopen a goal that was completed.
 *
 * Needed because raising the target of a reached goal is a normal thing to
 * do — "actually I want 150M, not 100M" — and without this the goal would
 * stay marked finished while its bar said otherwise.
 */
export async function reopenGoal(
  id: string,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const goal = await requireGoal(id);

  if (goal.status !== "COMPLETED") {
    throw new ConflictError("این هدف تکمیل نشده است.", "NOT_COMPLETED");
  }

  await prisma.goal.update({ where: { id }, data: { status: "ACTIVE" } });

  return (await getGoal(id, now))!;
}

/* -------------------------------------------------------------------------
 * Contributions (task 6.4)
 * ---------------------------------------------------------------------- */

/**
 * Put money aside, or take some back out.
 *
 * No transaction is written, and that is the point: earmarking money the
 * household already has is not spending it. Recording a contribution as an
 * expense would cut net worth every time the household saved, which is the
 * same mistake rule G.3 forbids for transfers.
 */
export async function addContribution(
  goalId: string,
  input: CreateContributionInput,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const goal = await requireGoal(goalId);

  if (goal.status === "ARCHIVED") {
    throw new ConflictError(
      "برای هدف بایگانی‌شده نمی‌توان مبلغ ثبت کرد.",
      "GOAL_ARCHIVED",
    );
  }

  await prisma.goalContribution.create({
    data: {
      goalId,
      amount: input.amount,
      isWithdrawal: input.isWithdrawal,
      date: input.date,
      note: input.note,
    },
  });

  await syncStatus(goalId);

  return (await getGoal(goalId, now))!;
}

/** Remove one contribution. The goal's total follows, because it is a sum. */
export async function removeContribution(
  goalId: string,
  contributionId: string,
  now: Date = new Date(),
): Promise<GoalDetailDto> {
  const row = await prisma.goalContribution.findUnique({
    where: { id: contributionId },
  });

  if (!row || row.goalId !== goalId) {
    throw new NotFoundError("این مبلغ پیدا نشد.");
  }

  await prisma.goalContribution.delete({ where: { id: contributionId } });
  await syncStatus(goalId);

  return (await getGoal(goalId, now))!;
}

/* -------------------------------------------------------------------------
 * Internals
 * ---------------------------------------------------------------------- */

/**
 * Complete a goal once its contributions reach the target.
 *
 * Promotion only, never the reverse. Reopening is `reopenGoal`, by hand, and
 * that asymmetry is deliberate: the household can mark a goal finished below
 * its target — deciding the holiday fund is enough at 80% is a real
 * decision — and a sync that also demoted would undo that silently on the
 * next contribution.
 *
 * So a goal that falls back below its target after a withdrawal or a raised
 * target stays marked complete until someone says otherwise. The progress
 * bar shows the truth either way, and reopening is one tap; quietly
 * overwriting a decision the household made is the worse of the two.
 *
 * An archived goal is left alone entirely: archiving is a decision about
 * whether the household is still looking at the goal, and reaching a target
 * is not a reason to drag it back out of the archive.
 */
async function syncStatus(id: string): Promise<void> {
  const goal = await prisma.goal.findUnique({
    where: { id },
    include: withContributions,
  });

  if (!goal || goal.status !== "ACTIVE") return;

  const reached = goalProgress(
    {
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      contributions: goal.contributions,
    },
    new Date(),
    monthOf,
  ).isReached;

  if (reached) {
    await prisma.goal.update({ where: { id }, data: { status: "COMPLETED" } });
  }
}

async function requireGoal(id: string): Promise<GoalModel> {
  const goal = await prisma.goal.findUnique({ where: { id } });

  if (!goal) throw new NotFoundError("هدف پیدا نشد.");

  return goal;
}
