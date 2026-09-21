"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme context for the whole application.
 *
 * `attribute="class"` toggles the `.dark` class that the token layer in
 * globals.css keys off, and `defaultTheme="system"` respects the operating
 * system until the user chooses otherwise.
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
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
