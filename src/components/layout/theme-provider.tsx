"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { MotionConfig } from "motion/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme and motion context for the whole application.
 *
 * `attribute="class"` toggles the `.dark` class that the token layer in
 * globals.css keys off, and `defaultTheme="system"` respects the operating
 * system until the user chooses otherwise.
 *
 * `reducedMotion="user"` makes every Motion animation honour the operating
 * system's reduced-motion setting: transforms jump to their end state while
 * opacity still fades, so nothing slides or scales for someone who asked it
 * not to (§0.7).
 *
 * `DirectionProvider` tells every Radix primitive the interface is RTL
 * (rule G.6). The document's `dir="rtl"` is not enough on its own: select
 * menus, dropdown menus and popovers render into a portal and read their
 * direction from this context, and without it their items are laid out
 * left-to-right — text on the left, the check mark on the wrong side, and
 * arrow-key navigation reversed.
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <DirectionProvider dir="rtl">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </DirectionProvider>
    </NextThemesProvider>
  );
}

export { ThemeProvider };
