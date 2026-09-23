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

  it("keeps a design-system font size and a text colour side by side", () => {
    // Without the scale registered, tailwind-merge read text-caption as a
    // colour and dropped whichever came first.
    expect(cn("text-caption text-muted-foreground", "text-danger")).toBe(
      "text-caption text-danger",
    );
    expect(cn("text-muted-foreground", "text-h3")).toBe(
      "text-muted-foreground text-h3",
    );
  });

  it("still lets a later design-system size replace an earlier one", () => {
    expect(cn("text-body", "text-h1")).toBe("text-h1");
  });
});
