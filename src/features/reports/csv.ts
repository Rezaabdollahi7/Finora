/**
 * CSV export (task 8.10).
 *
 * Hand-written rather than a dependency: the roadmap says not to add one
 * where the browser is enough, and the whole of CSV that matters here is
 * quoting. A library would be more code in `node_modules` than in this file.
 *
 * Two details that are easy to get wrong and would make the file useless:
 *
 * The **BOM**. Excel opens a UTF-8 CSV without one as Windows-1252 and turns
 * every Persian character into mojibake. Three bytes fix it, and every other
 * reader ignores them.
 *
 * **Money stays a decimal string of Toman.** Not a float, and not Rial: a
 * spreadsheet reading Rial would show figures a household does not recognise,
 * and a float would lose the last digits of a large one (rule G.2).
 */

const BOM = "﻿";

/**
 * Quote a field the way RFC 4180 asks.
 *
 * A field is quoted when it contains a comma, a quote, or a line break; a
 * quote inside is doubled. A leading `=`, `+`, `-` or `@` is prefixed with a
 * quote as well, because a spreadsheet would otherwise read the cell as a
 * formula — which is a real way for an exported ledger to execute something.
 */
function escape(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value);
  const text = risky ? `'${value}` : value;

  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rial as a plain decimal string of Toman, for a spreadsheet cell. */
export function tomanCell(rial: string | bigint): string {
  const value = BigInt(rial);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const toman = magnitude / 10n;
  const remainder = magnitude % 10n;

  const text = remainder === 0n ? `${toman}` : `${toman}.${remainder}`;

  return negative ? `-${text}` : text;
}

export type CsvTable = {
  /** The file's name, without an extension. */
  name: string;
  headers: string[];
  rows: (string | number)[][];
};

/** One table as a CSV document, ready to download. */
export function toCsv(table: CsvTable): string {
  const lines = [table.headers, ...table.rows].map((row) =>
    row.map((cell) => escape(String(cell))).join(","),
  );

  // CRLF, which is what RFC 4180 specifies and what Excel expects.
  return BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Several tables in one file, separated by a blank line.
 *
 * A household exporting "the report" wants the report, not six downloads.
 * Every reader handles the sections as one sheet; the titles say what each
 * block is.
 */
export function toCsvBundle(tables: CsvTable[]): string {
  const blocks = tables.map((table) => {
    const lines = [[table.name], table.headers, ...table.rows].map((row) =>
      row.map((cell) => escape(String(cell))).join(","),
    );

    return lines.join("\r\n");
  });

  return BOM + blocks.join("\r\n\r\n") + "\r\n";
}
