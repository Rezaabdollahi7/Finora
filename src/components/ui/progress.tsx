import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Rounded progress bar, docs/DESIGN_SYSTEM.md §31.
 *
 * Rendered with logical inset so the bar fills from the inline start, which
 * is the right-hand edge in Persian (rule G.6).
 */
function Progress({
  className,
  value,
  max = 100,
  tone = "primary",
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value: number;
  max?: number;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-border",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "absolute inset-y-0 start-0 rounded-full transition-[width] duration-300 ease-out",
          tone === "primary" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-danger",
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export { Progress };
