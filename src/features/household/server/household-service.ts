import "server-only";

import type { Owner } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  absoluteJalaliMonth,
  fromAbsoluteJalaliMonth,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
} from "@/utils/date";
import { sumRial } from "@/utils/money";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { assetFiltersSchema } from "@/features/assets/schemas";
import { listAssets } from "@/features/assets/server/asset-service";
import { loanFiltersSchema } from "@/features/loans/schemas";
import { listLoans } from "@/features/loans/server/loan-service";
import { goalFiltersSchema } from "@/features/goals/schemas";
import { listGoals } from "@/features/goals/server/goal-service";
import { getBudgetMonth } from "@/features/budgets/server/budget-service";
import {
  contributions,
  householdTotals,
  retained,
  HOUSEHOLD_MEMBERS,
  type Contribution,
  type HouseholdMember,
  type MovementInput,
  type OwnerTotals,
} from "@/features/household/contribution";
import type {
  ContributionDto,
  HouseholdMonthDto,
  MemberViewDto,
  OwnerTotalsDto,
} from "@/features/household/types";

/**
 * Household data access (tasks 7.3–7.8).
 *
 * The arithmetic is in `contribution.ts` and has no database; this file
 * gathers what it needs for one Jalali month.
 *
 * The one thing worth knowing before reading further: a transaction carries
 * **two** owners, and they mean different things. `transaction.owner` says
 * whose record it is — a household cost or one person's. The owner of the
 * *account* says whose pocket the money came out of. A shared rent paid from
 * Reza's account is `owner: SHARED` with a REZA account, and it takes both
 * facts to say that the household spent it and Reza provided it.
 */

function toTotalsDto(totals: OwnerTotals): OwnerTotalsDto {
  return {
    income: totals.income.toString(),
    expenses: totals.expenses.toString(),
    savings: totals.savings.toString(),
  };
}

function toContributionDto(
  owner: HouseholdMember,
  contribution: Contribution,
): ContributionDto {
  return {
    owner,
    direct: contribution.direct.toString(),
    pooled: contribution.pooled.toString(),
    total: contribution.total.toString(),
  };
}

/**
 * One month of the household, in full.
 *
 * Six queries regardless of how much the household has: the month's
 * movements, the accounts, the assets, the loans, the goals, and one budget
 * read per person for their personal budgets.
 */
export async function getHouseholdMonth(
  month?: number,
  now: Date = new Date(),
): Promise<HouseholdMonthDto> {
  const target = month ?? absoluteJalaliMonth(jalaliMonthOf(now));
  const { start, end } = jalaliMonthRange(fromAbsoluteJalaliMonth(target));

  const [rows, accounts, assets, loans, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      select: {
        type: true,
        amount: true,
        owner: true,
        account: { select: { owner: true } },
        toAccount: { select: { owner: true } },
      },
    }),
    listAccounts(accountFiltersSchema.parse({})),
    listAssets(assetFiltersSchema.parse({})),
    listLoans(loanFiltersSchema.parse({}), now),
    listGoals(goalFiltersSchema.parse({}), now),
  ]);

  const movements: MovementInput[] = rows.map((row) => ({
    type: row.type,
    amount: row.amount,
    owner: row.owner,
    fromAccountOwner: row.account?.owner ?? null,
    toAccountOwner: row.toAccount?.owner ?? null,
  }));

  const totals = householdTotals(movements);
  const byMember = contributions(movements);

  // One budget read per person: a personal budget is scoped to its owner
  // (task 7.5), so the household's own budgets say nothing about it.
  const budgets = await Promise.all(
    HOUSEHOLD_MEMBERS.map((owner) => getBudgetMonth(target, now, owner)),
  );

  const members: MemberViewDto[] = HOUSEHOLD_MEMBERS.map((owner, index) => {
    const budget = budgets[index]!;
    const theirGoals = goals.filter(
      (goal) => goal.owner === owner && goal.status === "ACTIVE",
    );

    return {
      owner,
      totals: toTotalsDto(totals.byMember[owner]),
      contribution: toContributionDto(owner, byMember[owner]),
      retained: retained(totals.byMember[owner], byMember[owner]).toString(),
      accountBalance: balanceOf(accounts, owner),
      budget:
        budget.lines.length === 0
          ? null
          : {
              amount: budget.totals.amount,
              spent: budget.totals.spent,
              remaining: budget.totals.remaining,
              count: budget.lines.length,
            },
      goals: {
        count: theirGoals.length,
        targetAmount: sumRial(
          theirGoals.map((goal) => BigInt(goal.progress.targetAmount)),
        ).toString(),
        currentAmount: sumRial(
          theirGoals.map((goal) => BigInt(goal.progress.currentAmount)),
        ).toString(),
      },
    };
  });

  const { year, month: monthOfYear } = fromAbsoluteJalaliMonth(target);

  return {
    month: target,
    label: jalaliMonthLabel({ year, month: monthOfYear }),
    household: toTotalsDto(totals.household),
    shared: toTotalsDto(totals.shared),
    contributions: HOUSEHOLD_MEMBERS.map((owner) =>
      toContributionDto(owner, byMember[owner]),
    ),
    members,
    // What the household holds jointly, as distinct from what either person
    // owns. An archived asset or loan is out of play and is not listed here.
    sharedAssets: sumRial(
      assets
        .filter((asset) => asset.owner === "SHARED")
        .map((asset) => BigInt(asset.currentValue)),
    ).toString(),
    sharedLiabilities: sumRial(
      loans
        .filter((loan) => loan.owner === "SHARED" && loan.status !== "ARCHIVED")
        .map((loan) => BigInt(loan.progress.remainingAmount)),
    ).toString(),
  };
}

function balanceOf(
  accounts: { owner: Owner; isActive: boolean; balance: string }[],
  owner: Owner,
): string {
  return sumRial(
    accounts
      .filter((account) => account.isActive && account.owner === owner)
      .map((account) => BigInt(account.balance)),
  ).toString();
}
