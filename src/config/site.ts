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
