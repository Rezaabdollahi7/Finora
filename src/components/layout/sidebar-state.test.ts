import { describe, expect, it } from "vitest";

import { isSidebarCollapsed, sidebarCookieValue } from "./sidebar-state";

describe("sidebar preference", () => {
  it("round-trips both states through the cookie value", () => {
    expect(isSidebarCollapsed(sidebarCookieValue(true))).toBe(true);
    expect(isSidebarCollapsed(sidebarCookieValue(false))).toBe(false);
  });

  it("treats a missing or unrecognised cookie as expanded", () => {
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed("")).toBe(false);
    expect(isSidebarCollapsed("COLLAPSED")).toBe(false);
  });
});
