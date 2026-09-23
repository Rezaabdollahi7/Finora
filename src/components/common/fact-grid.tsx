import { cn } from "@/lib/utils";

export type Fact = { label: string; value: React.ReactNode; wide?: boolean };

/**
 * The facts of one record — its type, owner, dates, terms — as a grid of
 * small tiles rather than a ruled list (§0.13): the label small and muted,
 * the value under it, each tile a unit the eye can land on. A `wide` fact
 * (a note, a long description) spans the row.
 */
function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {facts.map((fact) => (
        <div
          key={fact.label}
          className={cn(
            "flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-4 py-3",
            fact.wide && "col-span-2 sm:col-span-3",
          )}
        >
          <dt className="truncate text-caption text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 text-body font-medium break-words">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { FactGrid };
