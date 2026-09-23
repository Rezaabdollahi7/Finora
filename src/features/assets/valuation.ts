import { multiplyByQuantity } from "@/utils/quantity";

/**
 * Asset valuation and profit/loss (tasks 3.5 and 3.6).
 *
 * Pure arithmetic over `bigint`, with no database and no Prisma types, so the
 * rules can be tested directly rather than through a service (rule G.11) and
 * so there is exactly one implementation of each formula. The service, the
 * portfolio page and the net-worth engine all call these.
 */

/** The minimum an asset has to tell us to be worth anything. */
export type Valuable = {
  /** Scaled by 10^8; see utils/quantity. */
  quantity: bigint;
  /** Rial per unit. For a fixed-value asset, quantity is 1, so this is it. */
  unitPrice: bigint;
};

/**
 * Current value = quantity × current price (task 3.5).
 *
 * Fixed-value assets are not a special case: their quantity is exactly one,
 * so the same multiplication gives their stated value back unchanged. One
 * formula means one place to get the rounding right.
 */
export function assetValue({ quantity, unitPrice }: Valuable): bigint {
  return multiplyByQuantity(unitPrice, quantity);
}

export type ProfitLoss = {
  /** Current value in Rial. */
  value: bigint;
  /** What the holding cost, in Rial. */
  cost: bigint;
  /** value − cost. Negative is a loss. */
  profitLoss: bigint;
  /**
   * profitLoss ÷ cost, or null when the cost basis is zero.
   *
   * A percentage return on a cost of nothing is either infinite or undefined,
   * and neither is something to put on a card. A gifted asset has a real
   * value and a real profit; it has no meaningful *rate* of return, and
   * saying so is more honest than printing ∞ or 0%.
   */
  returnRatio: number | null;
};

/**
 * P/L = current value − total purchase cost (task 3.6).
 *
 * The cost basis is the *current* quantity at the purchase unit price, which
 * assumes one acquisition price for the whole holding. Buying gold twice at
 * different prices needs lot tracking, which the roadmap does not ask for;
 * editing the purchase price to the blended average is the intended way to
 * handle it, and the field is editable for that reason.
 */
export function profitAndLoss(input: {
  quantity: bigint;
  purchaseUnitPrice: bigint;
  currentUnitPrice: bigint;
}): ProfitLoss {
  const value = assetValue({
    quantity: input.quantity,
    unitPrice: input.currentUnitPrice,
  });
  const cost = assetValue({
    quantity: input.quantity,
    unitPrice: input.purchaseUnitPrice,
  });

  return {
    value,
    cost,
    profitLoss: value - cost,
    returnRatio: ratioOf(value - cost, cost),
  };
}

/**
 * A ratio for display.
 *
 * `Number()` on a bigint is safe here because the result is a rendered
 * percentage, never a monetary value — the exact amount always travels
 * alongside it.
 */
export function ratioOf(part: bigint, whole: bigint): number | null {
  if (whole === 0n) return null;
  return Number(part) / Number(whole);
}

/** Sum a portfolio's value and cost, and the P/L that follows from them. */
export function portfolioTotals(
  entries: readonly { value: bigint; cost: bigint }[],
): ProfitLoss {
  let value = 0n;
  let cost = 0n;

  for (const entry of entries) {
    value += entry.value;
    cost += entry.cost;
  }

  return {
    value,
    cost,
    profitLoss: value - cost,
    returnRatio: ratioOf(value - cost, cost),
  };
}
