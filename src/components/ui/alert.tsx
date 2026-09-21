import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Alerts use subtle semantic surfaces, never saturated fills (§34). */
const alertVariants = cva(
  cn(
    "relative grid w-full gap-1 rounded-md border px-4 py-3 text-body",
    "has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3",
    "[&>svg]:size-[18px] [&>svg]:translate-y-0.5",
  ),
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground [&>svg]:text-muted-foreground",
        info: "border-transparent bg-primary-soft text-foreground [&>svg]:text-primary",
        success:
          "border-transparent bg-success-subtle text-foreground [&>svg]:text-success",
        warning:
          "border-transparent bg-warning-subtle text-foreground [&>svg]:text-warning",
        destructive:
          "border-transparent bg-danger-subtle text-foreground [&>svg]:text-danger",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 font-semibold", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
