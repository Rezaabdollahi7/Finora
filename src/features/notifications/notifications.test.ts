import { describe, expect, it } from "vitest";

import {
  countBySeverity,
  goalMilestone,
  KIND_SEVERITY,
  orderNotifications,
  type Notification,
} from "@/features/notifications/notifications";

const make = (
  id: string,
  kind: Notification["kind"],
  date: string | null = null,
  title = id,
): Notification => ({
  id,
  kind,
  severity: KIND_SEVERITY[kind],
  title,
  amount: null,
  href: "/",
  date,
});

describe("severity", () => {
  it("treats money already late or gone as critical", () => {
    for (const kind of [
      "INSTALLMENT_OVERDUE",
      "RECURRING_OVERDUE",
      "BUDGET_EXCEEDED",
      "CASH_SHORTFALL",
    ] as const) {
      expect(KIND_SEVERITY[kind]).toBe("CRITICAL");
    }
  });

  it("treats money about to go as a warning", () => {
    for (const kind of [
      "INSTALLMENT_DUE",
      "RECURRING_DUE",
      "BUDGET_WARNING",
    ] as const) {
      expect(KIND_SEVERITY[kind]).toBe("WARNING");
    }
  });

  it("keeps the only good news quietest", () => {
    // A household opening this list wants the problems first.
    expect(KIND_SEVERITY.GOAL_MILESTONE).toBe("INFO");
  });
});

describe("orderNotifications", () => {
  it("puts the most urgent first", () => {
    const ordered = orderNotifications([
      make("goal", "GOAL_MILESTONE"),
      make("due", "INSTALLMENT_DUE"),
      make("late", "INSTALLMENT_OVERDUE"),
    ]);

    expect(ordered.map((n) => n.id)).toEqual(["late", "due", "goal"]);
  });

  it("puts the soonest first within a severity", () => {
    const ordered = orderNotifications([
      make("b", "INSTALLMENT_OVERDUE", "2026-09-10T00:00:00.000Z"),
      make("a", "INSTALLMENT_OVERDUE", "2026-09-01T00:00:00.000Z"),
    ]);

    expect(ordered.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("sorts a standing condition after the dated ones", () => {
    // A budget is over now; an instalment is late on a day. The one with a
    // deadline attached is the one to look at first.
    const ordered = orderNotifications([
      make("budget", "BUDGET_EXCEEDED", null),
      make("late", "INSTALLMENT_OVERDUE", "2026-09-01T00:00:00.000Z"),
    ]);

    expect(ordered.map((n) => n.id)).toEqual(["late", "budget"]);
  });

  it("breaks a tie by title, so the list cannot reorder itself", () => {
    const ordered = orderNotifications([
      make("b", "BUDGET_EXCEEDED", null, "ب"),
      make("a", "BUDGET_EXCEEDED", null, "الف"),
    ]);

    expect(ordered.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("does not mutate what it was handed", () => {
    const input = [make("goal", "GOAL_MILESTONE"), make("late", "INSTALLMENT_OVERDUE")];
    orderNotifications(input);

    expect(input.map((n) => n.id)).toEqual(["goal", "late"]);
  });

  it("returns nothing for nothing", () => {
    expect(orderNotifications([])).toEqual([]);
  });
});

describe("countBySeverity", () => {
  it("counts each severity", () => {
    expect(
      countBySeverity([
        make("a", "INSTALLMENT_OVERDUE"),
        make("b", "BUDGET_EXCEEDED"),
        make("c", "BUDGET_WARNING"),
        make("d", "GOAL_MILESTONE"),
      ]),
    ).toEqual({ CRITICAL: 2, WARNING: 1, INFO: 1 });
  });

  it("is all zeroes for an empty list", () => {
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, INFO: 0 });
  });
});

describe("goalMilestone", () => {
  it("announces only the highest quarter crossed", () => {
    // A goal at 78% has passed three of them; three notifications saying the
    // same thing is two too many.
    expect(goalMilestone(0.78)).toBe(0.75);
  });

  it("says nothing below the first quarter", () => {
    expect(goalMilestone(0.24)).toBeNull();
    expect(goalMilestone(0)).toBeNull();
  });

  it("announces a goal exactly on a quarter", () => {
    expect(goalMilestone(0.25)).toBe(0.25);
    expect(goalMilestone(0.5)).toBe(0.5);
  });

  it("announces a reached goal, and does not go past one", () => {
    expect(goalMilestone(1)).toBe(1);
    expect(goalMilestone(1.4)).toBe(1);
  });
});
