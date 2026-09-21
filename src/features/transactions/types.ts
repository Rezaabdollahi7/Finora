import type { TransactionType } from "@/generated/prisma/enums";

import type { Owner } from "@/features/accounts/types";

export type { TransactionType };

/**
 * A transaction as it crosses a boundary.
 *
 * `amount` is a decimal string of whole Rial and is always positive — the
 * direction of the movement lives in `type`, never in the sign (rule G.2).
 */
export type TransactionDto = {
  id: string;
  type: TransactionType;
  amount: string;
  accountId: string;
  accountName: string;
  /** Transfers only: the destination. */
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** Icon key for the category; resolved through the icon map in the UI. */
  categoryIcon: string | null;
  owner: Owner;
  description: string | null;
  /** ISO-8601 UTC. Rendered as Jalali at the presentation layer (rule G.5). */
  date: string;
  createdAt: string;
  updatedAt: string;
};

export const TRANSACTION_TYPES = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
] as const satisfies readonly TransactionType[];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "درآمد",
  EXPENSE: "هزینه",
  TRANSFER: "انتقال",
};
