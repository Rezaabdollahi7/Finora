import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("supports conditional object and array syntax", () => {
    expect(cn({ a: true, b: false }, ["c"])).toBe("a c");
  });

  it("lets a later Tailwind utility override an earlier one", () => {
    // This is the whole reason cn exists: a caller's className must be able
    // to beat a component's default.
    expect(cn("p-4", "p-6")).toBe("p-6");
    expect(cn("bg-card", "bg-primary")).toBe("bg-primary");
  });

  it("keeps utilities that only look similar", () => {
    expect(cn("ps-4", "pe-6")).toBe("ps-4 pe-6");
  });
});
