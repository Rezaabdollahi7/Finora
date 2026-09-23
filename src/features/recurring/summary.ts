import { sumRial } from "@/utils/money";
import type { Owner } from "@/features/accounts/types";
import type { OccurrenceDto, RecurringPaymentDto } from "@/features/recurring/types";

/**
 * What the recurring payments screen leads with.
 *
 * Deliberately a sum of real occurrences rather than an arithmetic guess at a
 * "monthly equivalent": a weekly rule falls four or five times in thirty
 * days and a yearly one usually not at all, so dividing and multiplying to
 * smooth them into one number would produce a figure no month ever actually
 * costs.
 *
 * Arrears are counted apart from what is ahead. Folding them together would
 * make a household that is two bills behind look like one with an expensive
 * month coming, and those need different responses.
 */
export type RecurringSummary = {
  /** Everything still owed with a date from today onwards, in Rial. */
  upcoming: string;
  /** How many dates are already behind. */
  overdueCount: number;
  /** What those overdue dates come to, in Rial. */
  overdueAmount: string;
  /** Active rules among the ones being looked at. */
  activeCount: number;
};

/**
 * Summarise a set of rules and the occurrences around them.
 *
 * `owner` narrows both halves at once. An occurrence carries a rule id and
 * not an owner, so the rules are the only place the owner lives — which is
 * why they are passed alongside rather than the occurrences filtered first.
 */
export function summariseRecurring(
  payments: RecurringPaymentDto[],
  occurrences: OccurrenceDto[],
  owner: Owner | "ALL",
): RecurringSummary {
  const ownerOf = new Map(payments.map((payment) => [payment.id, payment.owner]));

  const mine = occurrences.filter(
    (entry) =>
      entry.status !== "PAID" &&
      (owner === "ALL" || ownerOf.get(entry.recurringPaymentId) === owner),
  );

  const overdue = mine.filter((entry) => entry.status === "OVERDUE");

  return {
    upcoming: sumRial(
      mine
        .filter((entry) => entry.status !== "OVERDUE")
        .map((entry) => BigInt(entry.amount)),
    ).toString(),
    overdueCount: overdue.length,
    overdueAmount: sumRial(overdue.map((entry) => BigInt(entry.amount))).toString(),
    activeCount: payments.filter(
      (payment) => payment.isActive && (owner === "ALL" || payment.owner === owner),
    ).length,
  };
}
