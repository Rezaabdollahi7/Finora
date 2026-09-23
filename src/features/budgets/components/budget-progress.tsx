import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/common/money";
import { formatPercent } from "@/utils/number";
import { BUDGET_STATE_STYLE } from "@/features/budgets/format";
import type { BudgetState } from "@/features/budgets/tracking";

/**
 * How far into a budget the household is (task 5.8).
 *
 * The amounts lead, because "۱۸٫۵ از ۲۵ میلیون" is the sentence a person
 * says about a budget; the bar is the shape of that sentence. A bar alone
 * would be a percentage with no unit.
 *
 * The bar is capped at the limit while the number beside it is not: a month
 * at 140% still draws a full bar, and the figure is what says how far past.
 * Letting the bar overflow its track would make one over-budget category
 * look worse than another for no reason a reader could measure.
 */
export function BudgetProgressBar({
  spent,
  available,
  ratio,
  state,
  className,
  showAmounts = true,
}: {
  /** Rial, as a decimal string. */
  spent: string;
  /** Rial, as a decimal string. */
  available: string;
  ratio: number;
  state: BudgetState;
  className?: string;
  showAmounts?: boolean;
}) {
  const style = BUDGET_STATE_STYLE[state];

  return (
    <div className={cn("space-y-2", className)}>
      {showAmounts ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          {/*
            Each part is its own element rather than one interpolated string:
            a neutral separator between Persian text and a number is
            reordered by the bidi algorithm.
          */}
          <span className="flex items-baseline gap-1.5 text-body font-medium">
            <Money rial={spent} unit={false} />
            <span className="text-muted-foreground">از</span>
            <Money rial={available} unit={false} className="text-muted-foreground" />
          </span>
          <span
            className={cn(
              "tabular text-caption",
              state === "OVER" ? "text-danger" : "text-muted-foreground",
            )}
            dir="ltr"
          >
            {formatPercent(ratio, { fractionDigits: 0 })}
          </span>
        </div>
      ) : null}

      <Progress value={Math.min(ratio, 1) * 100} tone={style.tone} />
    </div>
  );
}
