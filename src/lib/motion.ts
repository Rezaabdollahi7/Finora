/**
 * Motion tokens (docs/DESIGN_SYSTEM.md §0.7), shared by Motion and GSAP so
 * the two libraries move with one voice. The CSS side lives in globals.css
 * as --ease-out-soft and --ease-emphasized.
 *
 * Durations are in seconds, which is what both libraries take.
 */

/** cubic-bezier(0.22, 1, 0.36, 1): fast out, long settle. The default. */
export const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const;

/** cubic-bezier(0.2, 0.8, 0.2, 1): for large surfaces and the theme reveal. */
export const EASE_EMPHASIZED = [0.2, 0.8, 0.2, 1] as const;

export const DURATION = {
  /** Hover, press, toggles. */
  fast: 0.18,
  /** Cards entering, menus opening. */
  base: 0.45,
  /** The theme reveal and other full-surface changes. */
  slow: 0.7,
} as const;

/** The spring the active navigation pill rides between items. */
export const SPRING_PILL = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.9,
} as const;

/** Softer spring for surfaces that change size, like the sidebar. */
export const SPRING_SURFACE = { type: "spring", stiffness: 260, damping: 32 } as const;

/** GSAP spells the soft-out curve as an expo-out. */
export const GSAP_EASE = "expo.out";
