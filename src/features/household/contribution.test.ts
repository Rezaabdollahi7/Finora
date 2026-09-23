import { describe, expect, it } from "vitest";

import {
  contributions,
  householdTotals,
  isMember,
  retained,
  type MovementInput,
} from "@/features/household/contribution";

const toman = (value: number) => BigInt(value) * 10n;

/** The two people of the roadmap's examples, by member id. */
const PEOPLE = ["REZA", "YEGANEH"];

const income = (amount: number, owner: MovementInput["owner"], into = owner) =>
  ({
    type: "INCOME",
    amount: toman(amount),
    owner,
    fromAccountOwner: null,
    toAccountOwner: into,
  }) satisfies MovementInput;

const expense = (
  amount: number,
  owner: MovementInput["owner"],
  paidFrom: MovementInput["owner"],
) =>
  ({
    type: "EXPENSE",
    amount: toman(amount),
    owner,
    fromAccountOwner: paidFrom,
    toAccountOwner: null,
  }) satisfies MovementInput;

const transfer = (
  amount: number,
  from: MovementInput["owner"],
  to: MovementInput["owner"],
) =>
  ({
    type: "TRANSFER",
    amount: toman(amount),
    owner: from,
    fromAccountOwner: from,
    toAccountOwner: to,
  }) satisfies MovementInput;

/** The roadmap's own example, plus the household's shared costs. */
const MONTH: MovementInput[] = [
  income(30_000_000, "REZA"),
  income(5_000_000, "REZA"),
  income(30_000_000, "YEGANEH"),
  expense(38_000_000, "SHARED", "REZA"),
  expense(9_000_000, "SHARED", "SHARED"),
  expense(4_000_000, "REZA", "REZA"),
  expense(2_500_000, "YEGANEH", "YEGANEH"),
  transfer(10_000_000, "YEGANEH", "SHARED"),
];

describe("isMember", () => {
  it("separates the two people from the shared pot", () => {
    expect(isMember("REZA", PEOPLE)).toBe(true);
    expect(isMember("YEGANEH", PEOPLE)).toBe(true);
    expect(isMember("SHARED", PEOPLE)).toBe(false);
  });
});

describe("householdTotals", () => {
  it("tracks each person's income separately, as task 7.3 asks", () => {
    const { byMember } = householdTotals(MONTH, PEOPLE);

    expect(byMember.REZA!.income).toBe(toman(35_000_000));
    expect(byMember.YEGANEH!.income).toBe(toman(30_000_000));
  });

  it("keeps shared expenses apart from personal ones", () => {
    const { shared, byMember } = householdTotals(MONTH, PEOPLE);

    expect(shared.expenses).toBe(toman(47_000_000));
    expect(byMember.REZA!.expenses).toBe(toman(4_000_000));
    expect(byMember.YEGANEH!.expenses).toBe(toman(2_500_000));
  });

  it("totals the whole household across every owner", () => {
    const { household } = householdTotals(MONTH, PEOPLE);

    expect(household.income).toBe(toman(65_000_000));
    expect(household.expenses).toBe(toman(53_500_000));
    expect(household.savings).toBe(toman(11_500_000));
  });

  it("adds up: the household is its three columns", () => {
    const { household, shared, byMember } = householdTotals(MONTH, PEOPLE);

    // Computed independently rather than by summing, so a discrepancy is
    // visible instead of arithmetically impossible.
    expect(shared.income + byMember.REZA!.income + byMember.YEGANEH!.income).toBe(
      household.income,
    );
    expect(shared.expenses + byMember.REZA!.expenses + byMember.YEGANEH!.expenses).toBe(
      household.expenses,
    );
  });

  it("never counts a transfer as income or spending", () => {
    // Rule G.3. Without this a person could inflate both sides of their own
    // column by shuffling their own money.
    const shuffled = [...MONTH, transfer(500_000_000, "REZA", "REZA")];
    const before = householdTotals(MONTH, PEOPLE);
    const after = householdTotals(shuffled, PEOPLE);

    expect(after.household).toEqual(before.household);
    expect(after.byMember.REZA!).toEqual(before.byMember.REZA!);
  });

  it("reports a negative saving rather than clamping it", () => {
    const { byMember } = householdTotals([expense(3_000_000, "REZA", "REZA")], PEOPLE);

    expect(byMember.REZA!.savings).toBe(toman(-3_000_000));
  });

  it("starts an empty household at zero everywhere", () => {
    const { household, shared, byMember } = householdTotals([], PEOPLE);

    for (const totals of [household, shared, byMember.REZA, byMember.YEGANEH]) {
      expect(totals).toEqual({ income: 0n, expenses: 0n, savings: 0n });
    }
  });

  it("keeps whole Rial past 2^53, where a double would round", () => {
    const huge = 9_007_199_254_740_993n;
    const { household } = householdTotals(
      [
        {
          type: "INCOME",
          amount: huge,
          owner: "REZA",
          fromAccountOwner: null,
          toAccountOwner: "REZA",
        },
        {
          type: "INCOME",
          amount: 1n,
          owner: "REZA",
          fromAccountOwner: null,
          toAccountOwner: "REZA",
        },
      ],
      PEOPLE,
    );

    expect(household.income).toBe(huge + 1n);
  });
});

describe("contributions", () => {
  it("counts a shared cost paid from a person's own account", () => {
    expect(contributions(MONTH, PEOPLE).REZA!.direct).toBe(toman(38_000_000));
  });

  it("counts money moved into the shared pot", () => {
    expect(contributions(MONTH, PEOPLE).YEGANEH!.pooled).toBe(toman(10_000_000));
  });

  it("does not credit anyone for spending money already pooled", () => {
    // The 9M shared expense came out of the shared account: it was both
    // people's money already, and crediting whoever pressed the button would
    // count it twice.
    const total =
      contributions(MONTH, PEOPLE).REZA!.total +
      contributions(MONTH, PEOPLE).YEGANEH!.total;

    expect(total).toBe(toman(48_000_000));
  });

  it("does not treat earning as giving", () => {
    // Reza earns 35M and Yeganeh 30M, but contributions follow what left
    // each pocket, not what entered it.
    const withoutIncome = contributions(
      MONTH.filter((m) => m.type !== "INCOME"),
      PEOPLE,
    );

    expect(withoutIncome).toEqual(contributions(MONTH, PEOPLE));
  });

  it("ignores a personal expense paid from a personal account", () => {
    // Reza's own 4M of personal spending is not a contribution to anything.
    expect(contributions(MONTH, PEOPLE).REZA!.total).toBe(toman(38_000_000));
  });

  it("ignores a transfer between a person's own accounts", () => {
    const shuffled = [...MONTH, transfer(20_000_000, "REZA", "REZA")];

    expect(contributions(shuffled, PEOPLE).REZA).toEqual(
      contributions(MONTH, PEOPLE).REZA,
    );
  });

  it("ignores a transfer out of the shared pot", () => {
    // The household paying a person back is not that person contributing.
    const refunded = [...MONTH, transfer(5_000_000, "SHARED", "REZA")];

    expect(contributions(refunded, PEOPLE)).toEqual(contributions(MONTH, PEOPLE));
  });

  it("sums the two routes into one figure", () => {
    const mixed = [...MONTH, transfer(6_000_000, "REZA", "SHARED")];
    const reza = contributions(mixed, PEOPLE).REZA!;

    expect(reza.direct).toBe(toman(38_000_000));
    expect(reza.pooled).toBe(toman(6_000_000));
    expect(reza.total).toBe(toman(44_000_000));
  });

  it("gives everyone zero in a household that has done nothing", () => {
    expect(contributions([], PEOPLE)).toEqual({
      REZA: { direct: 0n, pooled: 0n, total: 0n },
      YEGANEH: { direct: 0n, pooled: 0n, total: 0n },
    });
  });
});

describe("retained", () => {
  const forMember = (owner: "REZA" | "YEGANEH") =>
    retained(
      householdTotals(MONTH, PEOPLE).byMember[owner]!,
      contributions(MONTH, PEOPLE)[owner]!,
    );

  it("takes the household's share out of what a person kept", () => {
    // Reza earns 35M, spends 4M on himself and pays 38M of shared rent from
    // his own account. Income minus personal spending would call 31M his
    // savings in a month his account fell by 7M.
    expect(forMember("REZA")).toBe(toman(-7_000_000));
  });

  it("counts money pooled into the shared account as gone too", () => {
    // Yeganeh: 30M in, 2.5M personal, 10M pooled, 0 direct.
    expect(forMember("YEGANEH")).toBe(toman(17_500_000));
  });

  it("is not the same as income minus personal spending", () => {
    const totals = householdTotals(MONTH, PEOPLE).byMember.REZA!;

    expect(totals.savings).toBe(toman(31_000_000));
    expect(forMember("REZA")).not.toBe(totals.savings);
  });

  it("is plain savings for a person who contributed nothing", () => {
    const alone: MovementInput[] = [
      income(20_000_000, "REZA"),
      expense(5_000_000, "REZA", "REZA"),
    ];
    const totals = householdTotals(alone, PEOPLE).byMember.REZA!;

    expect(retained(totals, contributions(alone, PEOPLE).REZA!)).toBe(totals.savings);
  });
});

describe("any household", () => {
  it("handles however many people the household added", () => {
    const three = ["A", "B", "C"];
    const month: MovementInput[] = [
      income(10_000_000, "C"),
      expense(4_000_000, "SHARED", "C"),
      transfer(1_000_000, "B", "SHARED"),
    ];

    expect(householdTotals(month, three).byMember.C!.income).toBe(toman(10_000_000));
    expect(contributions(month, three).C!.direct).toBe(toman(4_000_000));
    expect(contributions(month, three).B!.pooled).toBe(toman(1_000_000));
    expect(contributions(month, three).A!.total).toBe(0n);
  });

  it("files everything under the household when there is nobody to split it by", () => {
    const { household, shared, byMember } = householdTotals(MONTH, []);

    expect(byMember).toEqual({});
    expect(contributions(MONTH, [])).toEqual({});
    // Personal records of a member no longer listed still count toward the
    // household, never toward "shared".
    expect(household.income).toBe(toman(65_000_000));
    expect(shared.income).toBe(0n);
  });
});
