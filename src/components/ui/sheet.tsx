"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-ink-surface/40",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Drawer surface, docs/DESIGN_SYSTEM.md §33.
 *
 * `side` is expressed with logical values: "start"/"end" follow the writing
 * direction, so the same component opens from the right in Persian and from
 * the left in a left-to-right locale without a second implementation
 * (rule G.6). "bottom" is the preferred mobile presentation.
 */
function SheetContent({
  className,
  children,
  side = "end",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "start" | "end" | "top" | "bottom";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-6 bg-popover p-6 text-popover-foreground shadow-floating",
          "transition ease-out data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "end" && [
            "inset-y-0 end-0 h-full w-3/4 max-w-sm rounded-s-xl",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "rtl:data-[state=open]:slide-in-from-left rtl:data-[state=closed]:slide-out-to-left",
          ],
          side === "start" && [
            "inset-y-0 start-0 h-full w-3/4 max-w-sm rounded-e-xl",
            "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
            "rtl:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-right",
          ],
          side === "top" && [
            "inset-x-0 top-0 h-auto rounded-b-xl",
            "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
          ],
          side === "bottom" && [
            "inset-x-0 bottom-0 h-auto rounded-t-xl",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          ],
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            "absolute top-4 end-4 inline-flex size-9 items-center justify-center",
            "rounded-md text-muted-foreground transition-colors",
            "hover:bg-primary-soft hover:text-foreground",
          )}
        >
          <XIcon className="size-[18px]" />
          <span className="sr-only">بستن</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-2 text-start", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-h3 font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-body text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
