import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/common/money";
import { formatPercent } from "@/utils/number";
import { GOAL_STATE_STYLE } from "@/features/goals/format";
import type { GoalDto } from "@/features/goals/types";

/**
 * How far into a goal the household is (task 6.3).
 *
 * The amounts lead, because "۴۵ از ۱۰۰ میلیون" is the sentence a person says
 * about a goal; the bar is the shape of that sentence. A bar alone would be a
 * percentage with no unit.
 */
export function GoalProgressBar({
  progress,
  className,
  showAmounts = true,
}: {
  progress: GoalDto["progress"];
  className?: string;
  showAmounts?: boolean;
}) {
  const style = GOAL_STATE_STYLE[progress.state];

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
            <Money rial={progress.currentAmount} unit={false} />
            <span className="text-muted-foreground">از</span>
            <Money
              rial={progress.targetAmount}
              unit={false}
              className="text-muted-foreground"
            />
          </span>
          <span className="tabular text-caption text-muted-foreground" dir="ltr">
            {formatPercent(progress.ratio, { fractionDigits: 0 })}
          </span>
        </div>
      ) : null}

      <Progress value={progress.ratio * 100} tone={style.tone} />
    </div>
  );
}
