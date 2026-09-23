import { describe, expect, it } from "vitest";

import { greetingForHour, hourInZone } from "./greeting";

describe("greetingForHour", () => {
  it.each([
    [4, "صبح بخیر"],
    [10, "صبح بخیر"],
    [11, "ظهر بخیر"],
    [14, "ظهر بخیر"],
    [15, "عصر بخیر"],
    [18, "عصر بخیر"],
    [19, "شب بخیر"],
    [23, "شب بخیر"],
    [0, "شب بخیر"],
    [3, "شب بخیر"],
  ])("greets hour %i with %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("hourInZone", () => {
  it("reads the hour on the household's clock, not UTC", () => {
    // 07:30 UTC is 11:00 in Tehran (UTC+03:30).
    const instant = new Date("2026-09-23T07:30:00Z");

    expect(hourInZone(instant, "UTC")).toBe(7);
    expect(hourInZone(instant, "Asia/Tehran")).toBe(11);
  });

  it("uses a 0-23 clock, so midnight is 0 rather than 24", () => {
    expect(hourInZone(new Date("2026-09-23T00:10:00Z"), "UTC")).toBe(0);
  });
});
