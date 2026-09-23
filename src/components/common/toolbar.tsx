import { cn } from "@/lib/utils";

/**
 * The filter-and-action bar under a section hero (§0.13): tabs on the inline
 * start, the primary action on the inline end, on one glass strip. It
 * wraps on a phone, where its radius steps down from a pill so two rows of
 * controls do not sit in a lozenge.
 */
function Toolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "reveal flex flex-wrap items-center justify-between gap-3 rounded-xl p-2 sm:rounded-full",
        "border border-card-edge bg-glass glass-edge dark:border-border",
        className,
      )}
      style={{ "--i": 1 } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export { Toolbar };
