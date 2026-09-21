/**
 * Digit conversion between Latin (0-9) and Persian (۰-۹).
 *
 * Persian text in this application is written with Persian digits, but every
 * value that has to be parsed, compared, stored or sent to the server uses
 * Latin digits. These two functions are the boundary between the two.
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert every Latin digit in a string to its Persian form. */
export function toPersianDigits(value: string | number | bigint): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}

/**
 * Convert every Persian or Arabic-Indic digit to its Latin form.
 *
 * Arabic-Indic digits are included because Arabic keyboards and pasted text
 * produce them, and they are visually near-identical to Persian ones — a user
 * would have no way to tell why their input was rejected.
 */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = PERSIAN_DIGITS.indexOf(digit);
    if (persian !== -1) return String(persian);
    return String(ARABIC_INDIC_DIGITS.indexOf(digit));
  });
}

/** True when the string contains no digits other than Latin ones. */
export function hasOnlyLatinDigits(value: string): boolean {
  return !/[۰-۹٠-٩]/.test(value);
}
