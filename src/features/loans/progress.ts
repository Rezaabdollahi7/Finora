import { installmentStatus, type InstallmentStatus } from "@/features/loans/schedule";

/**
 * Loan progress (task 4.5).
 *
 * Pure arithmetic over the instalments, with no database. Every figure here
 * is derived from the schedule rather than stored on the loan: a "remaining
 * debt" column would be a second source of truth that goes wrong the moment
 * a payment is recorded, undone or back-dated — the same reason Account has
 * no balance column (see docs/ARCHITECTURE.md).
 */

export type ProgressInput = {
  dueDate: Date;
  paidAt: Date | null;
  amount: bigint;
};

export type LoanProgress = {
  total: number;
  paid: number;
  remaining: number;
  overdue: number;
  /** Sum of the instalments already paid, in Rial. */
  paidAmount: string;
  /** Sum of the instalments still owed, in Rial. */
  remainingAmount: string;
  /** Everything the loan will have cost when it is done, in Rial. */
  totalAmount: string;
  /** Sum of the instalments that are past their date and unpaid, in Rial. */
  overdueAmount: string;
  /** Paid ÷ total, 0–1. Zero for a loan with no instalments. */
  ratio: number;
  /** True once nothing is left to pay. */
  isSettled: boolean;
  /** The soonest unpaid instalment's due date, or null if none is left. */
  nextDueDate: string | null;
};

/**
 * Count and total the instalments by what state they are in.
 *
 * "Remaining debt" is what is still owed on the schedule, not the
 * outstanding principal. A household asks "how much is left to pay?", and
 * the answer is the instalments it has not yet paid — interest included,
 * because that is the money that will actually leave the account.
 */
export function loanProgress(
  installments: readonly ProgressInput[],
  now: Date = new Date(),
): LoanProgress {
  let paid = 0;
  let overdue = 0;
  let paidAmount = 0n;
  let remainingAmount = 0n;
  let overdueAmount = 0n;
  let nextDue: Date | null = null;

  for (const installment of installments) {
    const status: InstallmentStatus = installmentStatus(installment, now);

    if (status === "PAID") {
      paid += 1;
      paidAmount += installment.amount;
      continue;
    }

    remainingAmount += installment.amount;

    if (status === "OVERDUE") {
      overdue += 1;
      overdueAmount += installment.amount;
    }

    if (!nextDue || installment.dueDate < nextDue) nextDue = installment.dueDate;
  }

  const total = installments.length;
  const remaining = total - paid;

  return {
    total,
    paid,
    remaining,
    overdue,
    paidAmount: paidAmount.toString(),
    remainingAmount: remainingAmount.toString(),
    totalAmount: (paidAmount + remainingAmount).toString(),
    overdueAmount: overdueAmount.toString(),
    // A ratio is a display value, so a float is fine — the counts and the
    // amounts beside it stay exact.
    ratio: total === 0 ? 0 : paid / total,
    isSettled: total > 0 && remaining === 0,
    nextDueDate: nextDue?.toISOString() ?? null,
  };
}
