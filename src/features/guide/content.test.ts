import { describe, expect, it } from "vitest";

import { findNavItem, mainNavigation } from "@/config/navigation";
import { FEATURES, GETTING_STARTED } from "@/features/guide/content";

const route = (href: string) => href.split("#")[0]!;

describe("guide content", () => {
  it("points every step at a real section", () => {
    for (const step of GETTING_STARTED) {
      expect(findNavItem(route(step.href))?.href, step.title).toBe(route(step.href));
    }
  });

  it("describes every section except itself and settings, once each", () => {
    const described = FEATURES.map((feature) => feature.href);
    const expected = mainNavigation
      .map((item) => item.href)
      .filter((href) => href !== "/guide" && href !== "/settings");

    expect([...described].sort()).toEqual([...expected].sort());
    expect(new Set(described).size).toBe(described.length);
  });
});
