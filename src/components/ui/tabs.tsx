"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** Pill segmented control, docs/DESIGN_SYSTEM.md §22 — no heavy borders. */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // `max-w-full` and `flex-wrap` together, because `w-fit` alone lets
        // a strip of tabs grow past its parent: at 320px the dashboard's
        // range tabs sat at 321..378, off the screen and unreachable. They
        // only wrap when there is no room, so nothing changes at any width
        // where they already fit.
        "inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full bg-muted p-1",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap",
        "rounded-full px-4 text-body font-medium text-muted-foreground",
        "transition-colors duration-150 ease-out outline-none",
        "hover:text-foreground",
        "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
