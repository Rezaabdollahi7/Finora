import { toLatinDigits, toPersianDigits } from "@/utils/digits";

/**
 * Number formatting.
 *
 * Grouping uses the Latin comma rather than the Persian thousands separator
 * (٬), following docs/DESIGN_SYSTEM.md §41, which specifies `125,400,000` for
 * financial figures: a comma is unambiguous next to a Persian decimal mark and
 * keeps long amounts scannable in a table.
 */

export type DigitStyle = "latin" | "persian";

/**
 * Convert the digits of an already-formatted string.
 *
 * Only for values with no grouping or decimal marks — a day number, a year.
 * Anything formatted by Intl is produced in the right script to begin with,
 * via {@link numberLocale}.
 */
export function applyDigitStyle(value: string, digits: DigitStyle): string {
  return digits === "persian" ? toPersianDigits(value) : value;
}

/**
 * The formatting locale for a digit style.
 *
 * Persian digits come with Persian separators: the thousands mark is ٬
 * (U+066C) and the decimal mark is ٫ (U+066B). Substituting digits into an
 * en-US string would leave a Latin comma sitting between Persian digits —
 * "۱,۲۰۰" instead of "۱٬۲۰۰" — so the locale does the whole job.
 */
function numberLocale(digits: DigitStyle): string {
  return digits === "persian" ? "fa-IR" : "en-US";
}

/** Format an integer with grouping. Accepts bigint so money is safe. */
export function formatInteger(
  value: number | bigint,
  { digits = "latin" }: { digits?: DigitStyle } = {},
): string {
  return new Intl.NumberFormat(numberLocale(digits), {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format a number with a fixed number of decimal places. */
export function formatDecimal(
  value: number,
  {
    digits = "latin",
    fractionDigits = 2,
  }: { digits?: DigitStyle; fractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(numberLocale(digits), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * Format a ratio as a percentage, e.g. 0.742 -> "74.2%".
 *
 * `signDisplay` is passed through to Intl so a rate of return can show its
 * "+" beside a signed amount; "exceptZero" is the useful one, since a change
 * of exactly nothing reads better without a sign than with one.
 */
export function formatPercent(
  ratio: number,
  {
    digits = "latin",
    fractionDigits = 1,
    signDisplay,
  }: {
    digits?: DigitStyle;
    fractionDigits?: number;
    signDisplay?: Intl.NumberFormatOptions["signDisplay"];
  } = {},
): string {
  return new Intl.NumberFormat(numberLocale(digits), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    ...(signDisplay ? { signDisplay } : {}),
  }).format(ratio);
}

/**
 * Parse a number a user typed.
 *
 * Tolerates Persian and Arabic-Indic digits, Latin and Persian separators,
 * Persian and Latin decimal marks, surrounding whitespace, and the RTL marks
 * that leak in when text is copied out of an RTL document.
 *
 * Returns null rather than NaN, so a caller cannot forget to check.
 */
export function parseNumber(input: string): number | null {
  const normalized = normalizeNumericInput(input);
  if (normalized === "") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalise user-typed numeric text to a plain Latin-digit string.
 *
 * Shared by parseNumber and the money parser so both accept exactly the same
 * input. Exported for tests.
 */
export function normalizeNumericInput(input: string): string {
  return (
    toLatinDigits(input)
      // Directional marks and non-breaking spaces travel with copied RTL text.
      .replace(/[‌‎‏‪-‮ ]/g, "")
      .replace(/\s/g, "")
      // Thousands separators: Latin comma and Persian/Arabic variants.
      .replace(/[,٬،]/g, "")
      // Decimal marks: Persian decimal separator and Arabic decimal point.
      .replace(/[٫.]/g, ".")
      .trim()
  );
}
