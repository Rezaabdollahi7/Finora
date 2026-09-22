import type { Owner } from "@/generated/prisma/enums";

/**
 * Household arithmetic (tasks 7.3–7.7).
 *
 * No database and no dates: every movement arrives already gathered, which
 * is what lets the one genuinely contestable part — what "contributed to the
 * household" means — be written down, tested, and argued with.
 *
 * **This is informational and deliberately not a score.** The roadmap says so
 * outright (task 7.7), and nothing here ranks, orders by size, or computes a
 * share of anything. A household where one person earns more and the other
 * does more of the unpaid work is not behind on a leaderboard.
 */

/** The people in the household, as distinct from the shared pot. */
export const HOUSEHOLD_MEMBERS = ["REZA", "YEGANEH"] as const;

export type HouseholdMember = (typeof HOUSEHOLD_MEMBERS)[number];

export function isMember(owner: Owner): owner is HouseholdMember {
  return (HOUSEHOLD_MEMBERS as readonly Owner[]).includes(owner);
}

/** One movement of money, reduced to what the household arithmetic needs. */
export type MovementInput = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: bigint;
  /** Whose record it is: one of the two people, or the household. */
  owner: Owner;
  /** Who owns the account the money left. Null when nothing left one. */
  fromAccountOwner: Owner | null;
  /** Who owns the account the money arrived in. Null for an expense. */
  toAccountOwner: Owner | null;
};

export type OwnerTotals = {
  income: bigint;
  expenses: bigint;
  /** Income minus expenses. Negative in a month that spent more than it earned. */
  savings: bigint;
};

const zero = (): OwnerTotals => ({ income: 0n, expenses: 0n, savings: 0n });

/**
 * Income and spending, for the household and for each person (tasks 7.3–7.6).
 *
 * A transfer is never counted. Moving money between household accounts does
 * not change what the household earned or spent (rule G.3), and counting it
 * would let a person inflate both sides of their own column by shuffling
 * their own money.
 *
 * The household total is every movement, not the sum of the three columns
 * plus shared — it *is* that sum, and computing it independently is what
 * makes a discrepancy visible rather than arithmetically impossible.
 */
export function householdTotals(movements: MovementInput[]): {
  household: OwnerTotals;
  shared: OwnerTotals;
  byMember: Record<HouseholdMember, OwnerTotals>;
} {
  const household = zero();
  const shared = zero();
  const byMember: Record<HouseholdMember, OwnerTotals> = {
    REZA: zero(),
    YEGANEH: zero(),
  };

  for (const movement of movements) {
    if (movement.type === "TRANSFER") continue;

    const buckets = [
      household,
      movement.owner === "SHARED"
        ? shared
        : byMember[movement.owner as HouseholdMember],
    ];

    for (const bucket of buckets) {
      if (movement.type === "INCOME") bucket.income += movement.amount;
      else bucket.expenses += movement.amount;
    }
  }

  for (const bucket of [household, shared, byMember.REZA, byMember.YEGANEH]) {
    bucket.savings = bucket.income - bucket.expenses;
  }

  return { household, shared, byMember };
}

export type Contribution = {
  /** Shared costs paid straight out of this person's own account. */
  direct: bigint;
  /** Money moved from this person's account into a shared one. */
  pooled: bigint;
  /** The two together. */
  total: bigint;
};

/**
 * What each person put into the household (task 7.7).
 *
 * A contribution is money that left **that person's own pocket** for the
 * household's benefit, and it arrives by exactly two routes:
 *
 *   direct  a household expense paid straight from their own account —
 *           Reza pays the rent from his salary account.
 *   pooled  a transfer from their own account into a shared one — Reza
 *           moves 30M into the joint account each month.
 *
 * A household expense paid *from a shared account* is not anyone's
 * contribution: that money was already pooled, and counting it again would
 * credit whoever happened to press the button for money both people had
 * already put in.
 *
 * Income is not a contribution either. Earning is not the same as giving,
 * and a household where one person earns more but the other pays the rent
 * would otherwise read backwards.
 */
export function contributions(
  movements: MovementInput[],
): Record<HouseholdMember, Contribution> {
  const result: Record<HouseholdMember, Contribution> = {
    REZA: { direct: 0n, pooled: 0n, total: 0n },
    YEGANEH: { direct: 0n, pooled: 0n, total: 0n },
  };

  for (const movement of movements) {
    const payer = movement.fromAccountOwner;

    // Only a person can contribute; the household cannot contribute to
    // itself, and a movement with no paying account has no payer.
    if (payer === null || !isMember(payer)) continue;

    if (movement.type === "EXPENSE" && movement.owner === "SHARED") {
      result[payer].direct += movement.amount;
      continue;
    }

    if (movement.type === "TRANSFER" && movement.toAccountOwner === "SHARED") {
      result[payer].pooled += movement.amount;
    }
  }

  for (const member of HOUSEHOLD_MEMBERS) {
    result[member].total = result[member].direct + result[member].pooled;
  }

  return result;
}
