import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Money } from "@/components/common/money";
import { formatPercent } from "@/utils/number";

/**
 * Profit or loss, as an amount and a rate (task 3.6).
 *
 * Never the percentage alone. "+18%" says nothing about whether the household
 * is up eighteen thousand Toman or eighteen million, and the amount is the
 * figure a person actually acts on. The arrow carries the same information as
 * the colour, so the direction survives a reader who cannot separate the red
 * from the green (design system §59.3).
 */
export function ProfitLoss({
  rial,
  ratio,
  className,
  size = "default",
}: {
  /** Profit or loss in Rial; negative is a loss. */
  rial: string;
  /** profit ÷ cost, or null when the asset cost nothing. */
  ratio: number | null;
  className?: string;
  size?: "default" | "large";
}) {
  const value = BigInt(rial);
  const direction = value > 0n ? "up" : value < 0n ? "down" : "flat";
  const Icon = direction === "down" ? TrendingDown : TrendingUp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        direction === "up" && "text-success",
        direction === "down" && "text-danger",
        direction === "flat" && "text-muted-foreground",
        className,
      )}
    >
      {direction === "flat" ? null : <Icon className="size-4 shrink-0" aria-hidden />}
      <Money
        rial={rial}
        tone="default"
        signed
        unit={false}
        className={cn("font-semibold", size === "large" ? "text-h2" : "text-body")}
      />
      {ratio === null ? null : (
        <span className="tabular text-caption opacity-80" dir="ltr">
          {formatPercent(ratio, { fractionDigits: 1, signDisplay: "exceptZero" })}
        </span>
      )}
    </span>
  );
}
