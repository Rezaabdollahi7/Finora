import { cn } from "@/lib/utils";

/** Loading placeholder, docs/DESIGN_SYSTEM.md §36 — subtle, never a spinner. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-sm bg-skeleton", className)}
      {...props}
    />
  );
}

export { Skeleton };
