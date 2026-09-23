"use client";

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
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}

export { ThemeProvider };
