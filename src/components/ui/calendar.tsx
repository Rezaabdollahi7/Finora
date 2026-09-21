"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Gregorian date picker primitive.
 *
 * This is the shadcn/ui calendar over react-day-picker, kept as the generic
 * primitive. Finora shows Jalali dates to users, and the Persian calendar of
 * task 4.6 is a separate component built on the conversion layer -- this one
 * stays as the underlying Gregorian picker so both share one styling
 * vocabulary.
 *
 * `dir` defaults to rtl, which also swaps the navigation arrows' meaning, so
 * the chevrons are chosen from the resolved direction rather than hard-coded.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  dir = "rtl",
  ...props
}: DayPickerProps) {
  const dayCell = cn(
    "relative size-10 p-0 text-center",
    "[&:has([aria-selected])]:bg-primary-soft",
    "[&:has([aria-selected].day-range-end)]:rounded-e-md",
    "[&:has([aria-selected].day-range-start)]:rounded-s-md",
    "first:[&:has([aria-selected])]:rounded-s-md last:[&:has([aria-selected])]:rounded-e-md",
  );

  return (
    <DayPicker
      dir={dir}
      showOutsideDays={showOutsideDays}
      className={cn("w-fit p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-4",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-body font-semibold",
        nav: "flex items-center justify-between absolute inset-x-3 top-3",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "opacity-60 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "opacity-60 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-10 text-caption font-medium text-muted-foreground",
        week: "mt-1 flex w-full",
        day: dayCell,
        day_button: cn(
          "size-10 rounded-md p-0 text-body font-normal transition-colors",
          "hover:bg-primary-soft aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        today: "[&>button]:bg-muted [&>button]:font-semibold",
        outside: "text-text-disabled",
        disabled: "text-text-disabled opacity-50",
        range_middle: "[&>button]:bg-transparent [&>button]:text-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) => {
          // `orientation` is already resolved against `dir`, so "left" means
          // visually left in both writing directions.
          const Icon = orientation === "left" ? ChevronLeftIcon : ChevronRightIcon;
          return <Icon className="size-4" {...chevronProps} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
