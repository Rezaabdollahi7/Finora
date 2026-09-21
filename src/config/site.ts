/**
 * Application-wide constants.
 *
 * Finora is Persian-first and right-to-left, so the locale, direction and
 * currency are fixed here rather than negotiated per request, and every
 * formatting utility reads them from this one place.
 */
export const siteConfig = {
  name: "Finora",
  tagline: "مدیریت مالی شخصی و خانوادگی",
  /** BCP 47 tag used for Intl formatting. */
  locale: "fa-IR",
  direction: "rtl",
  /**
   * The household's time zone. Timestamps are stored in UTC, and every
   * Jalali conversion is anchored here rather than to the server's zone —
   * otherwise a late-evening transaction lands on the wrong day.
   */
  timeZone: "Asia/Tehran",
  /**
   * Money is stored as whole Rial (rule G.2) and shown to the user in Toman.
   * One Toman is ten Rial.
   */
  currency: {
    storageUnit: "IRR",
    displayUnit: "TOMAN",
    rialPerToman: 10n,
  },
} as const;

export type SiteConfig = typeof siteConfig;
