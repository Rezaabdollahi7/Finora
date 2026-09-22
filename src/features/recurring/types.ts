import type { Owner } from "@/generated/prisma/enums";

import type {
  OccurrenceStatus,
  RecurrenceFrequency,
} from "@/features/recurring/recurrence";

export type { RecurrenceFrequency, OccurrenceStatus };

/**
 * A recurring payment rule as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial, parsed back with
 * `BigInt()` and never with `Number()` (rule G.2).
 */
export type RecurringPaymentDto = {
  id: string;
  name: string;
  amount: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  paymentDay: number | null;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  owner: Owner;
  isActive: boolean;
  notes: string | null;
  /** The soonest date still owed, derived from the rule. Null once ended. */
  nextDueDate: string | null;
  /** Whether that next date is upcoming, due today, or already behind. */
  nextStatus: OccurrenceStatus | null;
  /** How many occurrences have been paid. */
  paidCount: number;
  /** Everything paid against this rule so far, in Rial. */
  paidTotal: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * One occurrence — expected or paid.
 *
 * An expected one has no `id`: it is a projection of the rule rather than a
 * row, and the pair (rule, due date) is what identifies it. Paying turns it
 * into a row and gives it one.
 */
export type OccurrenceDto = {
  /** Null while the occurrence is only expected. */
  id: string | null;
  recurringPaymentId: string;
  /** What it is called, taken from the rule. */
  name: string;
  dueDate: string;
  /** The rule's amount while expected; what was actually paid once paid. */
  amount: string;
  status: OccurrenceStatus;
  paidAt: string | null;
  paidTransactionId: string | null;
};

/** A rule with the occurrences around today, for the detail page. */
export type RecurringPaymentDetailDto = RecurringPaymentDto & {
  occurrences: OccurrenceDto[];
};
