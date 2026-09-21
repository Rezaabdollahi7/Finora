import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config/site";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.tagline,
  applicationName: siteConfig.name,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfeff" },
    { media: "(prefers-color-scheme: dark)", color: "#14151f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto <html>
    // before React hydrates, so the server and client markup differ by design.
    <html lang="fa" dir={siteConfig.direction} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
