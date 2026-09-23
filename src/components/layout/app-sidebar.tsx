"use client";

import * as React from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { SPRING_SURFACE } from "@/lib/motion";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
  sidebarCookieValue,
} from "@/components/layout/sidebar-state";

/** Widths include the aside's own 16px of padding on each side. */
const WIDTH = { expanded: 288, collapsed: 104 } as const;

/**
 * Desktop sidebar: a floating glass panel on the inline start — the right in
 * Persian — as the first child of the shell's row, with no direction-specific
 * positioning.
 *
 * It collapses to an icon rail, from its button or with Ctrl/⌘+B. The width
 * rides a spring, the content beside it reflows once, and the choice is
 * remembered in a cookie so the next page load renders at the right width
 * on the server instead of opening and snapping shut.
 */
function AppSidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  const toggle = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${sidebarCookieValue(next)}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }, []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toggle]);

  const width = collapsed ? WIDTH.collapsed : WIDTH.expanded;
  const ToggleIcon = collapsed ? PanelRightOpen : PanelRightClose;

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={SPRING_SURFACE}
      style={{ width }}
      className="sticky top-0 z-20 hidden h-dvh shrink-0 p-4 lg:block"
    >
      <TooltipProvider>
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden rounded-3xl",
            "border border-card-edge bg-glass glass-edge backdrop-blur-xl dark:border-border",
          )}
        >
          <div className={cn("pt-5 pb-4", collapsed ? "px-0" : "px-5")}>
            <Brand compact={collapsed} className={cn(collapsed && "justify-center")} />
          </div>

          <NavLinks
            id="sidebar"
            collapsed={collapsed}
            className={cn("flex-1 overflow-x-hidden overflow-y-auto pb-4", "px-3")}
          />

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری"}
              title="Ctrl + B"
              className={cn(
                "flex h-10 w-full items-center gap-3 rounded-full text-body text-muted-foreground",
                "transition-colors duration-150 ease-out hover:bg-primary-soft hover:text-foreground",
                collapsed ? "justify-center" : "px-4",
              )}
            >
              <ToggleIcon aria-hidden className="size-[18px] shrink-0" />
              {collapsed ? null : (
                <span className="animate-in truncate duration-300 fade-in">
                  جمع کردن
                </span>
              )}
            </button>
          </div>
        </div>
      </TooltipProvider>
    </motion.aside>
  );
}

export { AppSidebar };
