import { cn } from "@/lib/utils";

/**
 * Standard page heading: title, supporting sentence, and an optional action
 * area on the opposite side of the inline axis.
 */
function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-h1">{title}</h1>
        {description ? (
          <p className="text-body-lg text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };
