import type { AccountType } from "@/features/accounts/types";
import type { TransactionType } from "@/features/transactions/types";

/**
 * The balance rules (task 1.5), as pure functions.
 *
 * They are separated from the database so they can be reasoned about and
 * tested directly. Everything that computes a balance goes through
 * {@link balanceDelta}; there is no second place where a sign is decided.
 */

/** One movement's effect on one account. */
export type Movement = {
  type: TransactionType;
  /** Always positive Rial. */
  amount: bigint;
  accountId: string;
  toAccountId?: string | null;
};

/**
 * How a movement changes a given account's balance.
 *
 *   income    on the account            +amount
 *   expense   on the account            -amount
 *   transfer  out of the account        -amount
 *   transfer  into the account          +amount
 *   anything else                        0
 *
 * A transfer therefore moves money without creating or destroying any: the
 * two deltas cancel across the household (rule G.3).
 */
export function balanceDelta(movement: Movement, accountId: string): bigint {
  const { type, amount } = movement;

  if (movement.accountId === accountId) {
    if (type === "INCOME") return amount;
    // Expenses leave the account; a transfer leaves its source.
    return -amount;
  }

  if (type === "TRANSFER" && movement.toAccountId === accountId) {
    return amount;
  }

  return 0n;
}

/** The balance of an account given its opening balance and its movements. */
export function computeBalance(
  accountId: string,
  initialBalance: bigint,
  movements: Iterable<Movement>,
): bigint {
  let balance = initialBalance;

  for (const movement of movements) {
    balance += balanceDelta(movement, accountId);
  }

  return balance;
}

/**
 * Whether a movement counts toward household income.
 *
 * A transfer never does, however it is labelled: the money was already in the
 * household (rule G.3).
 */
export function countsAsIncome(type: TransactionType): boolean {
  return type === "INCOME";
}

/** Whether a movement counts toward household spending. Transfers never do. */
export function countsAsExpense(type: TransactionType): boolean {
  return type === "EXPENSE";
}

/**
 * Whether an account of this kind may hold a negative balance.
 *
 * Task 1.5 forbids transactions that create "invalid negative balances where
 * account rules prohibit it". What prohibits it is the kind of account:
 * physical money cannot go below zero — you cannot spend cash you are not
 * holding — while a bank, business or investment account can legitimately be
 * overdrawn, on margin, or settling.
 *
 * The check is applied to the account's resulting total, not to a running
 * balance at the transaction's date, so entering history out of chronological
 * order gives the same answer as entering it in order.
 */
export function allowsNegativeBalance(accountType: AccountType): boolean {
  return accountType !== "CASH" && accountType !== "WALLET";
}

/** The accounts a movement touches, in the order they are debited/credited. */
export function affectedAccountIds(movement: Movement): string[] {
  return movement.type === "TRANSFER" && movement.toAccountId
    ? [movement.accountId, movement.toAccountId]
    : [movement.accountId];
}
