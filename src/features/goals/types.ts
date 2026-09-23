import type { GoalKind, GoalStatus } from "@/generated/prisma/enums";
import type { Owner } from "@/features/members/types";

import type { GoalState } from "@/features/goals/progress";

export type { GoalKind, GoalStatus, GoalState };

export const GOAL_KINDS = [
  "EMERGENCY",
  "PURCHASE",
  "TRAVEL",
  "INVESTMENT",
  "EDUCATION",
  "OTHER",
] as const satisfies readonly GoalKind[];

export const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  EMERGENCY: "پس‌انداز اضطراری",
  PURCHASE: "خرید",
  TRAVEL: "سفر",
  INVESTMENT: "سرمایه‌گذاری",
  EDUCATION: "آموزش",
  OTHER: "سایر",
};

export const GOAL_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
] as const satisfies readonly GoalStatus[];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  ACTIVE: "در جریان",
  COMPLETED: "تکمیل‌شده",
  ARCHIVED: "بایگانی",
};

/**
 * A goal as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2). `ratio` is the one number
 * here that is not money: it is a proportion for the progress bar.
 */
export type GoalDto = {
  id: string;
  name: string;
  kind: GoalKind;
  owner: Owner;
  status: GoalStatus;
  icon: string | null;
  notes: string | null;
  targetDate: string | null;
  progress: {
    targetAmount: string;
    currentAmount: string;
    remainingAmount: string;
    ratio: number;
    isReached: boolean;
    monthsRemaining: number | null;
    /** What must go in each month to land on the date, or null without one. */
    monthlyContribution: string | null;
    state: GoalState;
  };
  contributionCount: number;
  createdAt: string;
  updatedAt: string;
};

/** One allocation toward a goal, or one taken back out. */
export type GoalContributionDto = {
  id: string;
  goalId: string;
  amount: string;
  isWithdrawal: boolean;
  date: string;
  note: string | null;
};

/** A goal with its contribution history, for the detail page. */
export type GoalDetailDto = GoalDto & { contributions: GoalContributionDto[] };
