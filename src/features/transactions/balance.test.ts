import { describe, expect, it } from "vitest";

import {
  affectedAccountIds,
  allowsNegativeBalance,
  balanceDelta,
  computeBalance,
  countsAsExpense,
  countsAsIncome,
  type Movement,
} from "@/features/transactions/balance";

const A = "account-a";
const B = "account-b";

const income = (amount: bigint, accountId = A): Movement => ({
  type: "INCOME",
  amount,
  accountId,
});
const expense = (amount: bigint, accountId = A): Movement => ({
  type: "EXPENSE",
  amount,
  accountId,
});
const transfer = (amount: bigint, from = A, to = B): Movement => ({
  type: "TRANSFER",
  amount,
  accountId: from,
  toAccountId: to,
});

describe("balanceDelta", () => {
  it("income increases the account's balance", () => {
    expect(balanceDelta(income(300_000_000n), A)).toBe(300_000_000n);
  });

  it("expense decreases the account's balance", () => {
    expect(balanceDelta(expense(50_000_000n), A)).toBe(-50_000_000n);
  });

  it("transfer decreases the source account", () => {
    expect(balanceDelta(transfer(10_000_000n), A)).toBe(-10_000_000n);
  });

  it("transfer increases the destination account", () => {
    expect(balanceDelta(transfer(10_000_000n), B)).toBe(10_000_000n);
  });

  it("is zero for an account the movement does not touch", () => {
    expect(balanceDelta(transfer(10_000_000n), "account-c")).toBe(0n);
    expect(balanceDelta(income(1n), B)).toBe(0n);
  });

  it("nets to zero across a transfer's two accounts (rule G.3)", () => {
    const movement = transfer(7_500_000n);
    expect(balanceDelta(movement, A) + balanceDelta(movement, B)).toBe(0n);
  });
});

describe("computeBalance", () => {
  it("applies every movement to the opening balance", () => {
    const movements = [income(100n), expense(30n), transfer(20n)];
    expect(computeBalance(A, 1_000n, movements)).toBe(1_050n);
    expect(computeBalance(B, 0n, movements)).toBe(20n);
  });

  it("does not depend on the order the movements are applied", () => {
    const movements = [income(100n), expense(30n), transfer(20n), income(5n)];
    const reversed = [...movements].reverse();

    expect(computeBalance(A, 1_000n, movements)).toBe(
      computeBalance(A, 1_000n, reversed),
    );
  });

  it("returns the opening balance when there are no movements", () => {
    expect(computeBalance(A, 42n, [])).toBe(42n);
  });

  it("stays exact past the floating-point safe range", () => {
    // Ten movements of MAX_SAFE_INTEGER Rial each. A float would lose the
    // trailing digits; bigint does not.
    const big = 9_007_199_254_740_991n;
    const movements = Array.from({ length: 10 }, () => income(big));

    expect(computeBalance(A, 0n, movements)).toBe(90_071_992_547_409_910n);
  });

  it("a transfer moves money without creating or destroying it", () => {
    const movements = [transfer(1_000n)];
    const household =
      computeBalance(A, 5_000n, movements) + computeBalance(B, 2_000n, movements);

    expect(household).toBe(7_000n);
  });
});

describe("income and expense classification", () => {
  it("counts only income as income and only expense as expense", () => {
    expect(countsAsIncome("INCOME")).toBe(true);
    expect(countsAsExpense("EXPENSE")).toBe(true);
  });

  it("never counts a transfer as either (rule G.3)", () => {
    expect(countsAsIncome("TRANSFER")).toBe(false);
    expect(countsAsExpense("TRANSFER")).toBe(false);
  });

  it("does not cross income and expense", () => {
    expect(countsAsIncome("EXPENSE")).toBe(false);
    expect(countsAsExpense("INCOME")).toBe(false);
  });
});

describe("allowsNegativeBalance", () => {
  it("forbids physical money from going below zero", () => {
    expect(allowsNegativeBalance("CASH")).toBe(false);
    expect(allowsNegativeBalance("WALLET")).toBe(false);
  });

  it("allows accounts that can legitimately be overdrawn", () => {
    for (const type of ["BANK", "BUSINESS", "INVESTMENT", "OTHER"] as const) {
      expect(allowsNegativeBalance(type), type).toBe(true);
    }
  });
});

describe("affectedAccountIds", () => {
  it("lists one account for income and expense, two for a transfer", () => {
    expect(affectedAccountIds(income(1n))).toEqual([A]);
    expect(affectedAccountIds(expense(1n))).toEqual([A]);
    expect(affectedAccountIds(transfer(1n))).toEqual([A, B]);
  });
});
