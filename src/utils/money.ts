import { siteConfig } from "@/config/site";
import {
  applyDigitStyle,
  formatInteger,
  normalizeNumericInput,
  type DigitStyle,
} from "@/utils/number";

/**
 * Money.
 *
 * Every monetary value in Finora is a `bigint` holding whole **Rial** — never
 * a `number`, never a float (rule G.2). Users think in **Toman**, so amounts
 * are converted at the presentation layer and nowhere else.
 *
 *     1 Toman = 10 Rial
 *
 * Working in the smaller unit means a Toman amount with no fractional part is
 * always an exact integer of Rial, and `bigint` arithmetic cannot lose
 * precision the way IEEE-754 does: 0.1 + 0.2 has no equivalent here.
 */

const RIAL_PER_TOMAN = siteConfig.currency.rialPerToman;

/** A Toman amount split into its integer part and its tenths of a Toman. */
export type TomanParts = {
  /** Whole Toman. Negative amounts carry the sign here. */
  toman: bigint;
  /** Remainder in Rial, always 0-9 and always non-negative. */
  rial: number;
  negative: boolean;
};

/** Absolute value of a bigint. */
export function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** Split a Rial amount into Toman and leftover Rial, exactly. */
export function rialToTomanParts(rial: bigint): TomanParts {
  const negative = rial < 0n;
  const magnitude = absBigInt(rial);

  return {
    toman: negative ? -(magnitude / RIAL_PER_TOMAN) : magnitude / RIAL_PER_TOMAN,
    rial: Number(magnitude % RIAL_PER_TOMAN),
    negative,
  };
}

/** Convert a whole-Toman amount to Rial for storage. */
export function tomanToRial(toman: bigint): bigint {
  return toman * RIAL_PER_TOMAN;
}

export type MoneyFormatOptions = {
  /**
   * Digit style. Money defaults to Latin digits, per
   * docs/DESIGN_SYSTEM.md §41, which specifies `125,400,000 تومان`.
   */
  digits?: DigitStyle;
  /** Append the unit label. Defaults to true. */
  withUnit?: boolean;
  /** Render a leading "+" for positive amounts (useful in comparisons). */
  signDisplay?: "auto" | "always";
};

/**
 * Format a Rial amount for display in Toman.
 *
 * The sub-Toman remainder is only shown when it is non-zero, so ordinary
 * amounts read cleanly while an odd Rial is never silently dropped
 * (rule G.2 again: display must not lie about the stored value).
 */
export function formatToman(
  rial: bigint,
  { digits = "latin", withUnit = true, signDisplay = "auto" }: MoneyFormatOptions = {},
): string {
  const { toman, rial: remainder, negative } = rialToTomanParts(rial);

  let body = formatInteger(absBigInt(toman), { digits });

  if (remainder !== 0) {
    const decimal = digits === "persian" ? "٫" : ".";
    body += decimal + applyDigitStyle(String(remainder), digits);
  }

  const sign = negative ? "−" : signDisplay === "always" && rial > 0n ? "+" : "";
  const value = sign + body;

  return withUnit ? `${value} تومان` : value;
}

/** Format a Rial amount as Rial, for the rare places that need the raw unit. */
export function formatRial(
  rial: bigint,
  { digits = "latin", withUnit = true }: MoneyFormatOptions = {},
): string {
  const negative = rial < 0n;
  const body = formatInteger(absBigInt(rial), { digits });
  const value = (negative ? "−" : "") + body;

  return withUnit ? `${value} ریال` : value;
}

/**
 * Parse a Toman amount a user typed into Rial for storage.
 *
 * Accepts Persian and Latin digits, thousands separators, an optional
 * fractional part, and a leading sign. Returns null on anything it cannot
 * read, so an unparseable amount can never silently become zero.
 *
 * The fractional part is handled as a string rather than by multiplying a
 * float, because `12.3 * 10` is 122.99999999999999 in IEEE-754 and this
 * function's whole purpose is to never let that happen.
 */
export function parseTomanToRial(input: string): bigint | null {
  const normalized = normalizeNumericInput(input)
    // A Unicode minus or Persian dash is what a user actually copies.
    .replace(/[−‐-―]/g, "-");

  if (normalized === "" || !/^[+-]?\d*(\.\d*)?$/.test(normalized)) return null;

  const negative = normalized.startsWith("-");
  const unsigned = normalized.replace(/^[+-]/, "");
  if (unsigned === "" || unsigned === ".") return null;

  const [wholePart = "", fractionPart = ""] = unsigned.split(".");

  // One decimal place of Toman is exactly one Rial; anything finer than that
  // does not exist as currency.
  if (fractionPart.length > 1) return null;

  const whole = wholePart === "" ? 0n : BigInt(wholePart);
  const tenths = fractionPart === "" ? 0n : BigInt(fractionPart);

  const rial = whole * RIAL_PER_TOMAN + tenths;
  return negative ? -rial : rial;
}

/**
 * Sum Rial amounts.
 *
 * Trivial, but it exists so that summing money is a named operation rather
 * than a `reduce` that someone later "simplifies" into floating point.
 */
export function sumRial(amounts: Iterable<bigint>): bigint {
  let total = 0n;
  for (const amount of amounts) total += amount;
  return total;
}

/**
 * Screen-reader label for an amount.
 *
 * Latin digits inside Persian text are announced inconsistently by some
 * screen readers, so the accessible label uses Persian digits even where the
 * visible text uses Latin ones.
 */
export function tomanAriaLabel(rial: bigint): string {
  return formatToman(rial, { digits: "persian" });
}
