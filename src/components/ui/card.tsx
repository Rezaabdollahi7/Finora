import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Card hierarchy from docs/DESIGN_SYSTEM.md §16-17.
 *
 * A card never carries a strong border and a strong shadow at once, so the
 * `ink` and `primary` variants drop the border entirely.
 */
const cardVariants = cva("flex flex-col", {
  variants: {
    variant: {
      default: "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
      compact: "rounded-md border border-border bg-card text-card-foreground shadow-sm",
      featured:
        "rounded-xl border border-border bg-card text-card-foreground shadow-md",
      /** The dark feature card of §7 — identical in light and dark themes. */
      ink: "rounded-xl bg-ink-surface text-ink-surface-foreground shadow-md",
      /** The purple highlight panel of §8. */
      primary: "rounded-xl bg-primary text-primary-foreground shadow-md",
      subtle: "rounded-lg bg-primary-soft text-foreground",
    },
    padding: {
      none: "",
      compact: "gap-4 p-4",
      default: "gap-6 p-6",
      large: "gap-6 p-8",
    },
  },
  defaultVariants: { variant: "default", padding: "default" },
});

function Card({
  className,
  variant,
  padding,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-start justify-between gap-4", className)}
      {...props}
    />
  );
}

/**
 * A card's title is an `h2`, not an `h3`.
 *
 * A card sits directly under the page's `h1` on most screens, and rendering
 * its title as `h3` skipped a level — a screen reader navigating by heading
 * goes straight from the page title to a level it has no parent for. The
 * dashboard, which groups its cards under a real section heading, ends up
 * with sibling `h2`s, which is valid and reads correctly.
 *
 * The size is a class, so nothing about this changes how it looks.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("text-h4 font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-body text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-action" className={cn("shrink-0", className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={className} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  cardVariants,
};
