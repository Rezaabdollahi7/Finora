"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host, docs/DESIGN_SYSTEM.md §34.
 *
 * Toasts are styled through the design tokens rather than Sonner's own
 * palette, and anchored to the inline start so they do not cover the primary
 * actions, which sit on the right in an RTL layout.
 */
function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      dir="rtl"
      position="bottom-left"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--success-subtle)",
          "--success-text": "var(--success)",
          "--error-bg": "var(--danger-subtle)",
          "--error-text": "var(--danger)",
          "--warning-bg": "var(--warning-subtle)",
          "--warning-text": "var(--warning)",
          "--info-bg": "var(--primary-soft)",
          "--info-text": "var(--primary)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
