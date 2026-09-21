import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

/** Application wordmark: the icon from app/icon.svg plus name and tagline. */
function Brand({
  className,
  showTagline = true,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <svg viewBox="0 0 32 32" className="size-5" fill="none">
          <path
            d="M9 21.5 14 15l4 4 5.5-8.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-h4 leading-tight font-bold">
          {siteConfig.name}
        </span>
        {showTagline ? (
          <span className="truncate text-caption text-muted-foreground">
            {siteConfig.tagline}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export { Brand };
