import { describe, expect, it } from "vitest";

import { summariseRecurring } from "@/features/recurring/summary";
import type { OccurrenceDto, RecurringPaymentDto } from "@/features/recurring/types";

function payment(
  id: string,
  overrides: Partial<RecurringPaymentDto> = {},
): RecurringPaymentDto {
  return {
    id,
    name: id,
    amount: "10000000",
    frequency: "MONTHLY",
    interval: 1,
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: null,
    paymentDay: 1,
    categoryId: null,
    categoryName: null,
    accountId: null,
    accountName: null,
    owner: "SHARED",
    isActive: true,
    notes: null,
    nextDueDate: null,
    nextStatus: null,
    paidCount: 0,
    paidTotal: "0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function occurrence(
  recurringPaymentId: string,
  status: OccurrenceDto["status"],
  amount: string,
): OccurrenceDto {
  return {
    id: status === "PAID" ? `${recurringPaymentId}-row` : null,
    recurringPaymentId,
    name: recurringPaymentId,
    dueDate: "2026-02-01T00:00:00.000Z",
    amount,
    status,
    paidAt: null,
    paidTransactionId: null,
  };
}

/**
 * Rent (shared) is upcoming, the internet bill (shared) is two months
 * behind, the gym (Yeganeh) is upcoming, and last month's rent is paid.
 */
const PAYMENTS = [
  payment("rent"),
  payment("internet"),
  payment("gym", { owner: "YEGANEH" }),
  payment("old", { isActive: false }),
];

const OCCURRENCES = [
  occurrence("rent", "UPCOMING", "450000000"),
  occurrence("rent", "PAID", "450000000"),
  occurrence("internet", "OVERDUE", "8500000"),
  occurrence("internet", "OVERDUE", "8500000"),
  occurrence("gym", "DUE", "30000000"),
];

describe("summariseRecurring", () => {
  it("sums only what is still owed and still ahead", () => {
    // Rent 45,000,000 + gym 3,000,000 Toman. The paid rent is not owed and
    // the overdue internet is not ahead.
    expect(summariseRecurring(PAYMENTS, OCCURRENCES, "ALL").upcoming).toBe("480000000");
  });

  it("counts arrears apart from what is ahead", () => {
    const summary = summariseRecurring(PAYMENTS, OCCURRENCES, "ALL");

    expect(summary.overdueCount).toBe(2);
    expect(summary.overdueAmount).toBe("17000000");
  });

  it("never counts a paid occurrence as owed", () => {
    const paidOnly = OCCURRENCES.filter((entry) => entry.status === "PAID");
    const summary = summariseRecurring(PAYMENTS, paidOnly, "ALL");

    expect(summary.upcoming).toBe("0");
    expect(summary.overdueCount).toBe(0);
  });

  it("narrows both halves to one owner", () => {
    const shared = summariseRecurring(PAYMENTS, OCCURRENCES, "SHARED");

    expect(shared.upcoming).toBe("450000000");
    expect(shared.overdueCount).toBe(2);

    const yeganeh = summariseRecurring(PAYMENTS, OCCURRENCES, "YEGANEH");

    expect(yeganeh.upcoming).toBe("30000000");
    expect(yeganeh.overdueCount).toBe(0);
  });

  it("counts only the active rules, and only the owner's", () => {
    expect(summariseRecurring(PAYMENTS, OCCURRENCES, "ALL").activeCount).toBe(3);
    expect(summariseRecurring(PAYMENTS, OCCURRENCES, "SHARED").activeCount).toBe(2);
    expect(summariseRecurring(PAYMENTS, OCCURRENCES, "REZA").activeCount).toBe(0);
  });

  it("keeps whole Rial through the sums, with no float in the middle", () => {
    // A figure past 2^53, where a double would start rounding: the sum must
    // still be exact to the Rial (rule G.2).
    const big = [
      occurrence("rent", "UPCOMING", "9007199254740993"),
      occurrence("rent", "UPCOMING", "1"),
    ];

    expect(summariseRecurring(PAYMENTS, big, "ALL").upcoming).toBe("9007199254740994");
  });

  it("returns zeroes rather than throwing on an empty screen", () => {
    expect(summariseRecurring([], [], "ALL")).toEqual({
      upcoming: "0",
      overdueCount: 0,
      overdueAmount: "0",
      activeCount: 0,
    });
  });
});
