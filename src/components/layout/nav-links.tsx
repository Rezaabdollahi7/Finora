"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { findNavItem, mainNavigation, type NavItem } from "@/config/navigation";

/**
 * The navigation list, shared by the desktop sidebar and the mobile sheet so
 * the two can never drift apart.
 *
 * Active state follows the design system (§26): a filled pill in the primary
 * colour, everything else muted text on a transparent background.
 */
function NavLinks({
  items = mainNavigation,
  onNavigate,
  className,
}: {
  items?: readonly NavItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const active = findNavItem(pathname);

  return (
    <nav className={cn("flex flex-col gap-2", className)} aria-label="بخش‌های اصلی">
      {items.map((item) => {
        const isActive = active?.href === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-full px-4",
              "text-body font-medium transition-colors duration-150 ease-out",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-primary-soft hover:text-foreground",
            )}
          >
            <item.icon className="size-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export { NavLinks };
