import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { LogoMark } from "@/components/layout/logo-mark";

/**
 * The Finora lockup: the mark on its gradient tile, then the name and the
 * tagline. `compact` drops everything but the tile, for the collapsed
 * sidebar rail.
 */
function Brand({
  className,
  showTagline = true,
  compact = false,
}: {
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md",
          "bg-card-solid shadow-md ring-1 ring-border",
        )}
      >
        <LogoMark className="h-6 w-auto" />
      </span>
      {compact ? (
        <span className="sr-only">{siteConfig.name}</span>
      ) : (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-h4 leading-tight font-bold tracking-tight">
            {siteConfig.name}
          </span>
          {showTagline ? (
            <span className="truncate text-caption text-muted-foreground">
              {siteConfig.tagline}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}

export { Brand };
