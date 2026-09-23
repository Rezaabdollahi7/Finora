/**
 * Whether the desktop sidebar is collapsed to its icon rail.
 *
 * Kept in a cookie rather than localStorage so the server renders the
 * sidebar at the right width on the first paint: reading localStorage after
 * hydration would draw the wide sidebar and then snap it shut.
 */
export const SIDEBAR_COOKIE = "finora-sidebar";

/** A year: the choice is a preference, not a session. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isSidebarCollapsed(value: string | undefined): boolean {
  return value === "collapsed";
}

export function sidebarCookieValue(collapsed: boolean): string {
  return collapsed ? "collapsed" : "expanded";
}
