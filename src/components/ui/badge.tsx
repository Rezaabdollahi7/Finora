import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badges are pills (docs/DESIGN_SYSTEM.md §23). Semantic variants use subtle
 * backgrounds with coloured text rather than saturated fills, so a table full
 * of statuses does not turn into a colour field.
 */
const badgeVariants = cva(
  cn(
    "inline-flex h-7 w-fit shrink-0 items-center justify-center gap-1.5",
    "rounded-full px-2.5 text-caption font-medium whitespace-nowrap",
    "[&_svg]:pointer-events-none [&_svg]:size-3.5",
  ),
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-accent-foreground",
        neutral: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        solid: "bg-primary text-primary-foreground",
        success: "bg-success-subtle text-success",
        danger: "bg-danger-subtle text-danger",
        warning: "bg-warning-subtle text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
