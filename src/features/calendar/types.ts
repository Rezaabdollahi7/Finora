import type { InstallmentStatus } from "@/features/loans/schedule";

/**
 * What kind of obligation a calendar entry is (task 4.7).
 *
 * Only loan instalments exist today. The rest are declared now because the
 * calendar, the day panel and the upcoming timeline all switch on this, and
 * adding a member later should be a new case in one map rather than a new
 * shape travelling through three components.
 */
export const CALENDAR_EVENT_KINDS = [
  "LOAN_INSTALLMENT",
  "RECURRING",
  "BILL",
  "GOAL_CONTRIBUTION",
  "OTHER",
] as const;

export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export const CALENDAR_EVENT_KIND_LABELS: Record<CalendarEventKind, string> = {
  LOAN_INSTALLMENT: "قسط وام",
  RECURRING: "پرداخت دوره‌ای",
  BILL: "قبض",
  GOAL_CONTRIBUTION: "واریز به هدف",
  OTHER: "سایر",
};

/** One dated obligation. */
export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  /** What it is, e.g. "قسط ۲۹ — وام مسکن". */
  title: string;
  /** Where it comes from, e.g. the provider's name. */
  subtitle: string | null;
  /** Amount owed, in Rial. */
  amount: string;
  /** Midnight Tehran of the day it falls on, as an ISO instant. */
  date: string;
  /** Whether it is settled, due, or late. */
  status: InstallmentStatus;
  /** Where the user goes to act on it. */
  href: string;
};

/** A day with something on it (task 4.8). */
export type CalendarDayEvents = {
  /** The day's midnight-Tehran instant, as an ISO string. */
  date: string;
  events: CalendarEvent[];
  /** Everything owed that day, in Rial. */
  total: string;
  /** What is still unpaid that day, in Rial. */
  unpaidTotal: string;
};

/** A whole month of the calendar. */
export type CalendarMonth = {
  year: number;
  month: number;
  label: string;
  /** Keyed by the day's ISO instant, so a grid cell is one lookup. */
  days: Record<string, CalendarDayEvents>;
  /** Every event in the month, soonest first. */
  events: CalendarEvent[];
  /** Everything owed in the month, in Rial. */
  total: string;
  unpaidTotal: string;
};
