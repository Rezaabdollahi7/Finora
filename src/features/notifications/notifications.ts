/**
 * The notification centre's rules (task 8.11).
 *
 * No database: every input arrives already gathered, so what a household is
 * told — and in what order — can be read and argued with in one place.
 *
 * Nothing here schedules, sends, or persists anything. A notification is a
 * **derived observation about the present**, recomputed on every read, for
 * the same reason an instalment's status is: three of these change with
 * nothing but the passage of time, and a stored copy would be wrong by
 * morning.
 */

export const NOTIFICATION_KINDS = [
  "INSTALLMENT_OVERDUE",
  "INSTALLMENT_DUE",
  "RECURRING_OVERDUE",
  "RECURRING_DUE",
  "BUDGET_EXCEEDED",
  "BUDGET_WARNING",
  "CASH_SHORTFALL",
  "GOAL_MILESTONE",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * How loud each kind is.
 *
 * `CRITICAL` is money already late or already gone; `WARNING` is money about
 * to be; `INFO` is worth knowing and nothing more. A goal milestone is the
 * only good news here, and it is deliberately the quietest — a household
 * opening this list wants the problems first.
 */
export const NOTIFICATION_SEVERITIES = ["CRITICAL", "WARNING", "INFO"] as const;

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const KIND_SEVERITY: Record<NotificationKind, NotificationSeverity> = {
  INSTALLMENT_OVERDUE: "CRITICAL",
  RECURRING_OVERDUE: "CRITICAL",
  BUDGET_EXCEEDED: "CRITICAL",
  CASH_SHORTFALL: "CRITICAL",
  INSTALLMENT_DUE: "WARNING",
  RECURRING_DUE: "WARNING",
  BUDGET_WARNING: "WARNING",
  GOAL_MILESTONE: "INFO",
};

const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

export type Notification = {
  /** Stable across reads, so a dismissal can outlive a refresh. */
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  /** The figure the notification turns on, in Rial. Null when it has none. */
  amount: string | null;
  /** Where the household goes to act on it. */
  href: string;
  /**
   * When the thing happens, as an ISO instant. Null for a standing
   * condition — a budget is over now, not on a date.
   */
  date: string | null;
};

/**
 * Order the list the way a household reads it.
 *
 * Severity first, then the soonest date, then the title. The last tie-break
 * matters more than it looks: without it two equally urgent notifications
 * swap places between refreshes, and a list that reorders itself while being
 * read is a list nobody trusts.
 */
export function orderNotifications(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;

    if (a.date !== b.date) {
      // A standing condition has no date and sorts after dated ones, which
      // are the ones with a deadline attached.
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date.localeCompare(b.date);
    }

    return a.title.localeCompare(b.title, "fa");
  });
}

/** How many of each severity, for the badge on the bell. */
export function countBySeverity(
  notifications: Notification[],
): Record<NotificationSeverity, number> {
  const counts: Record<NotificationSeverity, number> = {
    CRITICAL: 0,
    WARNING: 0,
    INFO: 0,
  };

  for (const notification of notifications) counts[notification.severity] += 1;

  return counts;
}

/**
 * The milestones a goal announces (task 8.11).
 *
 * Quarters, and only the highest one crossed. A goal at 78% has passed three
 * of them, and telling the household about all three is three notifications
 * saying the same thing.
 */
export const GOAL_MILESTONES = [0.25, 0.5, 0.75, 1] as const;

export function goalMilestone(ratio: number): number | null {
  const reached = GOAL_MILESTONES.filter((milestone) => ratio >= milestone);

  return reached.length === 0 ? null : reached[reached.length - 1]!;
}
