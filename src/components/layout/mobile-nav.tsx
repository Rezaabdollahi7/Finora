"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { findNavItem, groupedNavigation } from "@/config/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Every section, for small screens: the dock's "more" button opens it.
 *
 * A bottom sheet of tiles rather than a side drawer, because on a phone the
 * thumb is already at the bottom and a grid of large targets beats a long
 * list. The groups are the sidebar's, so the two read as one map. Choosing
 * a tile closes the sheet, so the user is not left looking at the menu
 * they just used.
 */
function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const active = findNavItem(pathname);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-5 overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+24px)]"
      >
        <SheetHeader>
          <span
            aria-hidden
            className="mx-auto h-1.5 w-12 rounded-full bg-border-strong"
          />
          <SheetTitle className="text-h4">همه بخش‌ها</SheetTitle>
          <SheetDescription className="sr-only">
            پیمایش بین بخش‌های برنامه
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="بخش‌های اصلی" className="flex flex-col gap-5">
          {groupedNavigation().map((group) => (
            <section key={group.label} className="flex flex-col gap-2">
              <h3 className="text-caption text-text-muted">{group.label}</h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.items.map((item) => {
                  const isActive = active?.href === item.href;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => {
                          setOpen(false);
                        }}
                        className={cn(
                          "flex h-22 flex-col items-center justify-center gap-2 rounded-lg px-2 text-center",
                          "text-caption font-medium transition-[background-color,scale] duration-150 active:scale-95",
                          isActive
                            ? "bg-(image:--gradient-brand) text-primary-foreground shadow-glow"
                            : "bg-muted text-foreground hover:bg-primary-soft",
                        )}
                      >
                        <item.icon aria-hidden className="size-5" />
                        <span className="line-clamp-2 leading-tight">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export { MobileNav };
