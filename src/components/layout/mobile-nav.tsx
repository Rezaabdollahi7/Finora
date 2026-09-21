"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "@/components/layout/brand";
import { NavLinks } from "@/components/layout/nav-links";

/**
 * Navigation drawer for small screens.
 *
 * Opens from the inline end so the sheet does not fly across the thumb on the
 * side the trigger sits on, and closes on navigation so the user is not left
 * looking at the menu they just used.
 */
function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="منوی پیمایش"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="end" className="w-72">
        <SheetHeader>
          <SheetTitle className="sr-only">بخش‌های اصلی</SheetTitle>
          <SheetDescription className="sr-only">
            پیمایش بین بخش‌های برنامه
          </SheetDescription>
          <Brand />
        </SheetHeader>
        <NavLinks
          className="overflow-y-auto"
          onNavigate={() => {
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export { MobileNav };
