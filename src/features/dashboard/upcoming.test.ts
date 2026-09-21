import { describe, expect, it } from "vitest";

import { groupUpcomingPayments } from "@/features/dashboard/upcoming";
import type { UpcomingPayment } from "@/features/dashboard/types";

const NOW = new Date("2026-09-21T09:00:00Z");

const payment = (days: number, amount = "1000", id = `p${days}`): UpcomingPayment => ({
  id,
  title: `قسط ${id}`,
  amount,
  dueDate: new Date(NOW.getTime() + days * 86_400_000).toISOString(),
  kind: "LOAN_INSTALMENT",
});

describe("groupUpcomingPayments", () => {
  it("names the near horizons a household thinks in", () => {
    const buckets = groupUpcomingPayments(
      [payment(0), payment(1), payment(4), payment(10), payment(25), payment(90)],
      NOW,
    );

    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "امروز",
      "فردا",
      "این هفته",
      "هفته آینده",
      "این ماه",
      "بعداً",
    ]);
  });

  it("omits buckets with nothing in them", () => {
    const buckets = groupUpcomingPayments([payment(0), payment(20)], NOW);

    expect(buckets.map((bucket) => bucket.key)).toEqual(["TODAY", "THIS_MONTH"]);
  });

  it("puts an overdue payment in today rather than hiding it", () => {
    // A payment that was due last week is owed now. Filing it under a past
    // heading, or dropping it, is how an overdue instalment gets missed.
    const buckets = groupUpcomingPayments([payment(-7, "5000", "late")], NOW);

    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.key).toBe("TODAY");
    expect(buckets[0]?.payments[0]?.id).toBe("late");
  });

  it("totals each bucket exactly", () => {
    const buckets = groupUpcomingPayments(
      [
        payment(0, "9007199254740993", "a"),
        payment(0, "1", "b"),
        payment(3, "500", "c"),
      ],
      NOW,
    );

    expect(buckets[0]?.total).toBe("9007199254740994");
    expect(buckets[1]?.total).toBe("500");
  });

  it("orders payments within a bucket by due date", () => {
    const buckets = groupUpcomingPayments(
      [payment(6, "1", "later"), payment(3, "1", "sooner")],
      NOW,
    );

    expect(buckets[0]?.payments.map((p) => p.id)).toEqual(["sooner", "later"]);
  });

  it("uses calendar days, not 24-hour spans", () => {
    // 23:00 Tehran today to 01:00 Tehran tomorrow is two hours but one day,
    // so this belongs under "tomorrow".
    const late = new Date("2026-09-21T19:30:00Z");
    const buckets = groupUpcomingPayments(
      [
        {
          id: "x",
          title: "اجاره",
          amount: "1000",
          dueDate: "2026-09-21T21:30:00.000Z",
          kind: "RECURRING",
        },
      ],
      late,
    );

    expect(buckets[0]?.key).toBe("TOMORROW");
  });

  it("returns nothing for an empty list", () => {
    expect(groupUpcomingPayments([], NOW)).toEqual([]);
  });
});
