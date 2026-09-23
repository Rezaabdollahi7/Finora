import { cn } from "@/lib/utils";

/**
 * Loading placeholder, docs/DESIGN_SYSTEM.md §36 — never a spinner.
 *
 * A soft band of light sweeps across the block rather than the whole block
 * pulsing: it reads as "on its way" rather than "broken". The sweep is a
 * transform on a pseudo-element, and reduced motion leaves the block still.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-skeleton",
        "after:absolute after:inset-0 after:animate-shimmer",
        "after:bg-linear-to-l after:from-transparent after:via-(--skeleton-shine) after:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
