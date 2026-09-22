import type { Owner } from "@/generated/prisma/enums";

import type { HouseholdMember } from "@/features/household/contribution";

export type { HouseholdMember, Owner };

/**
 * Income and spending for one scope, as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2).
 */
export type OwnerTotalsDto = {
  income: string;
  expenses: string;
  savings: string;
};

/** What one person put into the household (task 7.7). */
export type ContributionDto = {
  owner: HouseholdMember;
  /** Shared costs paid straight out of their own account. */
  direct: string;
  /** Money moved from their account into a shared one. */
  pooled: string;
  total: string;
};

/** One person's own picture (task 7.8). */
export type MemberViewDto = {
  owner: HouseholdMember;
  totals: OwnerTotalsDto;
  contribution: ContributionDto;
  /** Their own accounts' balances, in Rial. */
  accountBalance: string;
  /** What their personal budgets allow and what they have spent against them. */
  budget: { amount: string; spent: string; remaining: string; count: number } | null;
  /** Their goals still in progress. */
  goals: { count: number; targetAmount: string; currentAmount: string };
};

export type HouseholdMonthDto = {
  /** The Jalali month, as `absoluteJalaliMonth` produces it. */
  month: number;
  label: string;
  household: OwnerTotalsDto;
  shared: OwnerTotalsDto;
  contributions: ContributionDto[];
  members: MemberViewDto[];
  /** Assets and debts the household holds jointly (task 7.6). */
  sharedAssets: string;
  sharedLiabilities: string;
};
