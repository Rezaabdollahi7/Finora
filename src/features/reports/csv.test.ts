import { describe, expect, it } from "vitest";

import { toCsv, toCsvBundle, tomanCell } from "@/features/reports/csv";

const body = (csv: string) => csv.replace("﻿", "");

describe("tomanCell", () => {
  it("gives a plain decimal of Toman, not Rial", () => {
    // A spreadsheet showing Rial would print figures the household does not
    // recognise.
    expect(tomanCell("450000000")).toBe("45000000");
  });

  it("keeps the odd Rial rather than rounding it away", () => {
    expect(tomanCell("450000005")).toBe("45000000.5");
  });

  it("keeps the sign on the number, not inside it", () => {
    expect(tomanCell("-450000000")).toBe("-45000000");
  });

  it("stays exact past 2^53, where a float would lose digits", () => {
    expect(tomanCell("90071992547409930")).toBe("9007199254740993");
  });

  it("writes nothing as zero", () => {
    expect(tomanCell(0n)).toBe("0");
  });
});

describe("toCsv", () => {
  it("writes a header and its rows", () => {
    const csv = toCsv({
      name: "درآمد",
      headers: ["ماه", "مبلغ"],
      rows: [["شهریور", "45000000"]],
    });

    expect(body(csv)).toBe("ماه,مبلغ\r\nشهریور,45000000\r\n");
  });

  it("starts with a byte-order mark, or Excel mangles Persian", () => {
    expect(toCsv({ name: "x", headers: ["الف"], rows: [] }).startsWith("﻿")).toBe(true);
  });

  it("quotes a field containing a comma", () => {
    const csv = toCsv({ name: "x", headers: ["a"], rows: [["یک, دو"]] });

    expect(body(csv)).toContain('"یک, دو"');
  });

  it("doubles a quote inside a field", () => {
    const csv = toCsv({ name: "x", headers: ["a"], rows: [['او گفت "بله"']] });

    expect(body(csv)).toContain('"او گفت ""بله"""');
  });

  it("quotes a field containing a line break", () => {
    const csv = toCsv({ name: "x", headers: ["a"], rows: [["یک\nدو"]] });

    expect(body(csv)).toContain('"یک\nدو"');
  });

  it("defuses a cell a spreadsheet would run as a formula", () => {
    // An exported ledger must not be able to execute anything.
    for (const dangerous of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
      const csv = toCsv({ name: "x", headers: ["a"], rows: [[dangerous]] });
      expect(body(csv)).toContain(`'${dangerous}`);
    }
  });

  it("does not defuse an ordinary negative number", () => {
    // Money keeps its sign; only a *text* cell starting with a sign is at
    // risk, and tomanCell's output is a number the reader parses.
    const csv = toCsv({ name: "x", headers: ["a"], rows: [[tomanCell("-450000000")]] });

    expect(body(csv)).toContain("'-45000000");
  });

  it("writes only a header when there are no rows", () => {
    expect(body(toCsv({ name: "x", headers: ["a", "b"], rows: [] }))).toBe("a,b\r\n");
  });
});

describe("toCsvBundle", () => {
  it("names each block and separates them with a blank line", () => {
    const csv = body(
      toCsvBundle([
        { name: "درآمد", headers: ["ماه"], rows: [["شهریور"]] },
        { name: "هزینه", headers: ["ماه"], rows: [["مهر"]] },
      ]),
    );

    expect(csv).toBe("درآمد\r\nماه\r\nشهریور\r\n\r\nهزینه\r\nماه\r\nمهر\r\n");
  });

  it("carries one byte-order mark for the whole file, not one per block", () => {
    const csv = toCsvBundle([
      { name: "a", headers: ["x"], rows: [] },
      { name: "b", headers: ["y"], rows: [] },
    ]);

    expect(csv.split("﻿")).toHaveLength(2);
  });
});
