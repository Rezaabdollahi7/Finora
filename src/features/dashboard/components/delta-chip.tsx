import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatPercent } from "@/utils/number";
import { isGoodChange, monthOverMonth } from "@/features/dashboard/insights";

/**
 * Month-over-month change as a small pill: the direction, the size, and
 * whether that is good news for this particular figure — spending less is.
 * With no figure last month it says so in words instead of inventing a
 * percentage.
 */
export function DeltaChip({
  value,
  previous,
  goodWhen,
  onInk = false,
  fallback = "ماه قبل داده‌ای نیست",
  className,
}: {
  value: string;
  previous: string;
  goodWhen: "up" | "down" | "either";
  /** On the ink or gradient card, where semantic tints would not read. */
  onInk?: boolean;
  fallback?: string;
  className?: string;
}) {
  const change = monthOverMonth(value, previous);

  if (!change) {
    return (
      <p
        className={cn(
          "text-caption",
          onInk ? "text-ink-surface-muted" : "text-muted-foreground",
          className,
        )}
      >
        {fallback}
      </p>
    );
  }

  const good = isGoodChange(change, goodWhen);
  const Icon =
    change.direction === "up"
      ? TrendingUp
      : change.direction === "down"
        ? TrendingDown
        : Minus;

  return (
    <p className={cn("flex flex-wrap items-center gap-2 text-caption", className)}>
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium",
          onInk
            ? "bg-ink-surface-subtle text-ink-surface-foreground"
            : good === null
              ? "bg-muted text-muted-foreground"
              : good
                ? "bg-success-subtle text-success"
                : "bg-danger-subtle text-danger",
        )}
      >
        <Icon aria-hidden className="size-3.5" />
        <span className="tabular" dir="ltr">
          {formatPercent(change.ratio, { fractionDigits: 1 })}
        </span>
      </span>
      <span className={onInk ? "text-ink-surface-muted" : "text-muted-foreground"}>
        نسبت به ماه قبل
      </span>
    </p>
  );
}
