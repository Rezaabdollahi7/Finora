import type { OccurrenceStatus } from "@/features/recurring/recurrence";
import { INSTALLMENT_STATUS_STYLE } from "@/features/loans/format";

/**
 * How each occurrence state reads.
 *
 * Deliberately the same tones and icons a loan instalment uses: to a
 * household "the rent is overdue" and "the instalment is overdue" mean the
 * same thing, and the calendar shows them side by side. A second palette for
 * the same idea would make the two look like different kinds of problem.
 */
export const OCCURRENCE_STATUS_STYLE: Record<
  OccurrenceStatus,
  (typeof INSTALLMENT_STATUS_STYLE)[keyof typeof INSTALLMENT_STATUS_STYLE]
> = INSTALLMENT_STATUS_STYLE;
