import { describe, expect, it } from "vitest";

import { nextTheme } from "@/components/layout/theme-toggle";

describe("nextTheme", () => {
  it("switches to the opposite of what is showing", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("goes dark from a theme it cannot read yet, which renders light", () => {
    expect(nextTheme(undefined)).toBe("dark");
  });
});
