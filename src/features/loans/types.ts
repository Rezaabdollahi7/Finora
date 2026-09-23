import type { LoanStatus, Owner } from "@/generated/prisma/enums";

import type { LoanProgress } from "@/features/loans/progress";
import type { InstallmentStatus } from "@/features/loans/schedule";

export type { LoanStatus, InstallmentStatus, LoanProgress };

export const LOAN_STATUSES = [
  "ACTIVE",
  "SETTLED",
  "ARCHIVED",
] as const satisfies readonly LoanStatus[];

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  ACTIVE: "در جریان",
  SETTLED: "تسویه‌شده",
  ARCHIVED: "بایگانی‌شده",
};

/**
 * A loan as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2). `interestRate` is an
 * integer of basis points: 2300 is 23%.
 */
export type LoanDto = {
  id: string;
  name: string;
  provider: string;
  principalAmount: string;
  /** Annual rate in basis points. 2300 is 23%. */
  interestRate: number;
  installmentAmount: string;
  installmentCount: number;
  startDate: string;
  endDate: string;
  /** Day of the Jalali month, 1–31. Short months take their last day. */
  paymentDay: number;
  owner: Owner;
  status: LoanStatus;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  /** Counts and totals over the schedule; never stored (task 4.5). */
  progress: LoanProgress;
  createdAt: string;
  updatedAt: string;
};

export type InstallmentDto = {
  id: string;
  loanId: string;
  number: number;
  dueDate: string;
  amount: string;
  /** Derived from the due date and `paidAt`; never a column (task 4.3). */
  status: InstallmentStatus;
  paidAt: string | null;
  paidTransactionId: string | null;
};

/** A loan with its schedule, for the detail page. */
export type LoanDetailDto = LoanDto & { installments: InstallmentDto[] };

/** The interest a loan costs over its life, in Rial. */
export function loanInterestTotal(loan: {
  installmentAmount: string;
  installmentCount: number;
  principalAmount: string;
}): string {
  const repaid = BigInt(loan.installmentAmount) * BigInt(loan.installmentCount);
  return (repaid - BigInt(loan.principalAmount)).toString();
}
