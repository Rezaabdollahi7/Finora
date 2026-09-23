import { describe, expect, it } from "vitest";

import {
  dockHrefs,
  findNavItem,
  groupedNavigation,
  mainNavigation,
  navigationGroups,
} from "./navigation";

describe("navigation groups", () => {
  it("places every section in exactly one sidebar group", () => {
    const grouped = navigationGroups.flatMap((group) => group.hrefs);

    expect([...grouped].sort()).toEqual(mainNavigation.map((item) => item.href).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("resolves groups to real items in their declared order", () => {
    const groups = groupedNavigation();

    expect(groups.map((group) => group.label)).toEqual(
      navigationGroups.map((group) => group.label),
    );
    for (const [index, group] of groups.entries()) {
      expect(group.items.map((item) => item.href)).toEqual(
        navigationGroups[index]!.hrefs,
      );
    }
  });

  it("gives the dock only real sections, and no more than four", () => {
    expect(dockHrefs.length).toBeLessThanOrEqual(4);
    for (const href of dockHrefs) {
      expect(findNavItem(href)?.href).toBe(href);
    }
  });
});
