import { Construction } from "lucide-react";

import { Card } from "@/components/ui/card";

/**
 * Stands in for a section whose feature has not been built yet.
 *
 * Sprint 0 delivers routing and the shell, not business logic, so every
 * section renders this instead of an empty screen. It is deliberately not an
 * empty state: an empty state means "there is no data yet" and belongs with
 * the feature (rule G.9), whereas this says "this section does not exist
 * yet". Each one is replaced by real content in the sprint named on it.
 */
function SectionPlaceholder({ sprint }: { sprint: string }) {
  return (
    <Card
      variant="subtle"
      className="items-center gap-3 border border-dashed border-border-strong py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Construction className="size-6" />
      </span>
      <p className="text-h4">این بخش هنوز ساخته نشده است</p>
      <p className="max-w-sm text-body text-muted-foreground">
        در {sprint} پیاده‌سازی می‌شود.
      </p>
    </Card>
  );
}

export { SectionPlaceholder };
