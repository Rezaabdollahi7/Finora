import { siteConfig } from "@/config/site";
import { toLatinDigits } from "@/utils/digits";
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

/**
 * An amount as the user is typing it, with its thousands grouped.
 *
 * `12500000` reads as `12,500,000` while it is being typed, which is what
 * makes a missing or extra zero visible before the form is sent. Persian
 * and Arabic digits become Latin ones, the digits the amount is displayed
 * in everywhere else; anything that is not a digit, a leading minus or the
 * first decimal mark is dropped. Only the whole part is grouped.
 *
 * Text, not arithmetic: nothing here passes through a `number` (rule G.2),
 * and {@link parseTomanToRial} already ignores the separators, so the
 * grouped string is what the form holds and sends.
 */
export function groupAmountInput(input: string): string {
  const latin = toLatinDigits(input).replace(/[٫]/g, ".").trim();
  const negative = /^[-−‐-―]/.test(latin);
  const kept = latin.replace(/[^\d.]/g, "");

  const dot = kept.indexOf(".");
  const whole = dot === -1 ? kept : kept.slice(0, dot);
  const fraction = dot === -1 ? null : kept.slice(dot + 1).replace(/\./g, "");

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (negative ? "-" : "") + grouped + (fraction === null ? "" : `.${fraction}`);
}

/**
 * Where the caret belongs after {@link groupAmountInput} rewrote the text.
 *
 * Counted in the characters that survive grouping (digits, the minus, the
 * decimal mark): the caret stays after the same digit it was after, so
 * typing in the middle of `1,250,000` does not throw it to the end.
 */
export function caretAfterGrouping(
  raw: string,
  caret: number,
  grouped: string,
): number {
  const significant = (text: string) => groupAmountInput(text).replace(/,/g, "").length;
  const before = significant(raw.slice(0, caret));

  let seen = 0;
  for (let index = 0; index < grouped.length; index += 1) {
    if (seen === before) return index;
    if (grouped[index] !== ",") seen += 1;
  }

  return grouped.length;
}
