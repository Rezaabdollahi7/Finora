import {
  applyDigitStyle,
  formatInteger,
  normalizeNumericInput,
  type DigitStyle,
} from "@/utils/number";

/**
 * Quantities.
 *
 * A quantity is not money, but it is multiplied by money — 18.5 grams of gold
 * at 68,400,000 Rial a gram — so it is held to the same standard (rule G.2).
 * A float quantity would poison every value derived from it, so quantities
 * are `bigint` scaled by a fixed power of ten, exactly as money is a `bigint`
 * of whole Rial.
 *
 * Eight decimal places is set by the smallest thing a household can hold: one
 * satoshi. Grams of gold, whole shares and units of foreign currency all fit
 * inside it with room to spare.
 */

export const QUANTITY_DECIMALS = 8;

/** 10 ** QUANTITY_DECIMALS. A quantity of `1` is stored as this value. */
export const QUANTITY_SCALE = 100_000_000n;

/** Exactly one unit. Fixed-value assets always hold this. */
export const ONE_QUANTITY = QUANTITY_SCALE;

/**
 * Parse a quantity a user typed into its scaled `bigint`.
 *
 * Accepts Persian and Arabic-Indic digits, thousands separators and either
 * decimal mark, through the same normaliser the money parser uses — so
 * "۱۸٫۵" and "18.5" are the same 18.5 grams.
 *
 * Returns null on anything it cannot read, including a negative value: you
 * cannot hold less than none of something, and a negative holding would flip
 * the sign of a valuation without anything in the UI saying so.
 */
export function parseQuantity(input: string): bigint | null {
  const normalized = normalizeNumericInput(input);

  if (normalized === "" || !/^\+?\d*(\.\d*)?$/.test(normalized)) return null;

  const unsigned = normalized.replace(/^\+/, "");
  if (unsigned === "" || unsigned === ".") return null;

  const [wholePart = "", fractionPart = ""] = unsigned.split(".");

  // More precision than the scale can hold would be silently truncated, and
  // a holding that reads back differently from what was typed is a bug the
  // user cannot see. Reject it instead.
  if (fractionPart.length > QUANTITY_DECIMALS) return null;

  const whole = wholePart === "" ? 0n : BigInt(wholePart);
  const fraction =
    fractionPart === "" ? 0n : BigInt(fractionPart.padEnd(QUANTITY_DECIMALS, "0"));

  return whole * QUANTITY_SCALE + fraction;
}

/**
 * Format a scaled quantity for display.
 *
 * Trailing zeros are dropped, so 2 grams reads "2" rather than "2.00000000"
 * while 0.0234 BTC keeps every digit it needs. The integer part goes through
 * Intl so grouping and the decimal mark match the digit style — a Latin comma
 * between Persian digits is the bug this avoids (see utils/number).
 */
export function formatQuantity(
  value: bigint,
  { digits = "latin" }: { digits?: DigitStyle } = {},
): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;

  const whole = magnitude / QUANTITY_SCALE;
  const fraction = (magnitude % QUANTITY_SCALE)
    .toString()
    .padStart(QUANTITY_DECIMALS, "0")
    .replace(/0+$/, "");

  let body = formatInteger(whole, { digits });

  if (fraction !== "") {
    body += (digits === "persian" ? "٫" : ".") + applyDigitStyle(fraction, digits);
  }

  return (negative ? "−" : "") + body;
}

/**
 * `unitPrice × quantity`, in whole Rial.
 *
 * This is the one place the two scales meet, so it is the one place rounding
 * happens. The product carries `QUANTITY_DECIMALS` extra digits; dividing
 * them out has to round rather than truncate, or a holding priced in fractions
 * would drift a little further below its true value with every recalculation.
 *
 * Half is rounded away from zero — the rule a person doing this by hand uses.
 */
export function multiplyByQuantity(unitPrice: bigint, quantity: bigint): bigint {
  const product = unitPrice * quantity;
  const negative = product < 0n;
  const magnitude = negative ? -product : product;

  const rounded = (magnitude + QUANTITY_SCALE / 2n) / QUANTITY_SCALE;

  return negative ? -rounded : rounded;
}
