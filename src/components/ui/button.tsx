import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button variants follow docs/DESIGN_SYSTEM.md §0.5 and §18.
 *
 * Every button is a full pill: interactive controls are pills, surfaces are
 * rounded rectangles, and that one rule holds everywhere. Heights come from
 * the 8px scale: h-11 is the 44px default touch target (§46), h-9 is 36px
 * for compact toolbars, h-12 is 48px for hero actions.
 *
 * A press sinks the button by 2% — tactile feedback that costs a transform
 * and nothing else.
 */
const buttonVariants = cva(
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-full text-body font-medium outline-none",
    "transition-[color,background-color,box-shadow,transform] duration-150 ease-out",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-glow hover:bg-primary-strong dark:hover:bg-primary/90",
        secondary:
          "border border-border bg-card-solid text-foreground shadow-sm hover:bg-primary-soft",
        ghost: "text-foreground hover:bg-primary-soft",
        /** Round controls on the glass header and dock. */
        glass:
          "border border-card-edge bg-card-solid/70 text-foreground shadow-sm hover:bg-card-solid dark:border-border dark:bg-card-solid/60",
        outline:
          "border border-border-strong bg-transparent text-foreground hover:bg-primary-soft",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-caption",
        md: "h-11 px-[18px]",
        lg: "h-12 px-6 text-body-lg",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
