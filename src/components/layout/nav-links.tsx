"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "motion/react";

import { cn } from "@/lib/utils";
import { SPRING_PILL } from "@/lib/motion";
import { findNavItem, groupedNavigation, type NavItem } from "@/config/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The navigation list, shared by the desktop sidebar and the mobile sheet so
 * the two can never drift apart.
 *
 * The active item wears the brand-gradient pill, and the pill is one shared
 * layout element: moving to another section slides it from the old item to
 * the new one on a spring, so the eye follows where it went (§0.7). Each
 * instance gets its own layout group, so the sidebar's pill and the sheet's
 * never try to animate into each other.
 *
 * Collapsed, the list is an icon rail: labels leave the layout but stay in
 * the accessibility tree, and a tooltip names each icon on hover and focus.
 */
function NavLinks({
  id,
  collapsed = false,
  onNavigate,
  className,
}: {
  /** Layout-group id; must be unique per mounted list. */
  id: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const active = findNavItem(pathname);

  return (
    <LayoutGroup id={id}>
      <nav className={cn("flex flex-col gap-4", className)} aria-label="بخش‌های اصلی">
        {groupedNavigation().map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {collapsed ? (
              <span aria-hidden className="mx-auto mb-1 h-px w-6 bg-border" />
            ) : (
              <span aria-hidden className="px-4 pb-0.5 text-caption text-text-muted">
                {group.label}
              </span>
            )}
            <ul className="flex flex-col gap-0.5" aria-label={group.label}>
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={active?.href === item.href}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 40px rows: the desktop sidebar is pointer-driven, and thirteen
        // sections plus their groups must fit a 900px-tall window unscrolled.
        "group relative isolate flex h-10 items-center gap-3 rounded-full",
        "text-body font-medium whitespace-nowrap transition-colors duration-150 ease-out",
        collapsed ? "mx-auto w-10 justify-center" : "px-4",
        active
          ? "text-primary-foreground"
          : "text-muted-foreground hover:bg-primary-soft hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="active-pill"
          aria-hidden
          transition={SPRING_PILL}
          className="absolute inset-0 -z-10 rounded-full bg-(image:--gradient-brand) shadow-glow"
        />
      ) : null}
      <item.icon
        aria-hidden
        className="size-[18px] shrink-0 transition-transform duration-200 ease-out group-hover:scale-110"
      />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        // A CSS entrance rather than a Motion one, so the server-rendered
        // label is visible before hydration instead of waiting at opacity 0.
        <span className="animate-in truncate duration-300 fade-in">{item.label}</span>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      {/* Physical "left": the rail sits on the right in Persian, so its
          labels open toward the content. */}
      <TooltipContent side="left">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export { NavLinks };
