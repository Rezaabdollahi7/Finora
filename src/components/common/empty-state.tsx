import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Empty states must not read as errors (design system §35): an icon, a title,
 * a short explanation of what would fill the space, and the action that does
 * it.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg bg-primary-subtle px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" />
      </span>
      <div className="space-y-2">
        <p className="text-h4">{title}</p>
        <p className="mx-auto max-w-sm text-body text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
