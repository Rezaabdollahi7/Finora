import { calendarDaysBetween } from "@/utils/date";
import { sumRial } from "@/utils/money";
import type { UpcomingBucket, UpcomingPayment } from "@/features/dashboard/types";

/**
 * Group upcoming payments into the horizons a household actually thinks in
 * (task 2.8): today, tomorrow, the rest of this week, next week, the rest of
 * this month, and everything after.
 *
 * Pure, so it can be tested without a database, and it will keep working
 * unchanged when Sprint 4 and Sprint 5 start feeding it real obligations.
 */

const ORDER: { key: UpcomingBucket["key"]; label: string; maxDays: number }[] = [
  { key: "TODAY", label: "امروز", maxDays: 0 },
  { key: "TOMORROW", label: "فردا", maxDays: 1 },
  { key: "THIS_WEEK", label: "این هفته", maxDays: 7 },
  { key: "NEXT_WEEK", label: "هفته آینده", maxDays: 14 },
  { key: "THIS_MONTH", label: "این ماه", maxDays: 31 },
  { key: "LATER", label: "بعداً", maxDays: Number.POSITIVE_INFINITY },
];

export function groupUpcomingPayments(
  payments: UpcomingPayment[],
  now: Date = new Date(),
): UpcomingBucket[] {
  const buckets = new Map<UpcomingBucket["key"], UpcomingPayment[]>(
    ORDER.map((entry) => [entry.key, []]),
  );

  for (const payment of payments) {
    const days = calendarDaysBetween(now, new Date(payment.dueDate));

    // Anything already due sits in "today": it is owed now, and burying an
    // overdue payment under a past-dated heading is how it gets missed.
    const slot =
      ORDER.find((entry) => days <= entry.maxDays) ?? ORDER[ORDER.length - 1]!;
    buckets.get(slot.key)!.push(payment);
  }

  return ORDER.map((entry) => {
    const group = buckets.get(entry.key)!;

    return {
      key: entry.key,
      label: entry.label,
      payments: [...group].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      total: sumRial(group.map((payment) => BigInt(payment.amount))).toString(),
    };
  }).filter((bucket) => bucket.payments.length > 0);
}
