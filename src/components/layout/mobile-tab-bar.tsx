"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { findNavItem, mainNavigation } from "@/config/navigation";

/**
 * Bottom tab bar for phones.
 *
 * Mobile is designed rather than shrunk (rule G.10): the four sections a
 * household reaches for daily get a thumb-reachable bar at the bottom, and
 * everything else stays one tap away behind the drawer in the header. Each
 * target is 56px tall, comfortably past the 44px minimum of §46.
 */
const primaryHrefs = ["/dashboard", "/transactions", "/accounts", "/calendar"];

function MobileTabBar() {
  const pathname = usePathname();
  const active = findNavItem(pathname);
  const items = primaryHrefs
    .map((href) => mainNavigation.find((item) => item.href === href))
    .filter((item) => item !== undefined);

  return (
    <nav
      aria-label="پیمایش سریع"
      className={cn(
        "sticky bottom-0 z-40 border-t border-border bg-card lg:hidden",
        // Keep the bar clear of the home indicator on iOS.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const isActive = active?.href === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1",
                  "text-caption transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { MobileTabBar };
