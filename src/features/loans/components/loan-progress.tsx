import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/common/money";
import { formatPercent } from "@/utils/number";
import type { LoanProgress as LoanProgressData } from "@/features/loans/progress";

/**
 * How far through a loan the household is (task 4.5).
 *
 * The counts lead, because "۴۲ از ۱۲۰ قسط" is the sentence a person says
 * about a loan; the bar is the shape of that sentence and the amounts are
 * what it costs. The bar alone would be a percentage with no unit.
 *
 * It turns amber while anything is overdue: a loan that is 90% paid and two
 * instalments late is not a loan in good standing, and a bar that stays
 * green would say it was.
 */
export function LoanProgressBar({
  progress,
  className,
  showAmounts = true,
}: {
  progress: LoanProgressData;
  className?: string;
  showAmounts?: boolean;
}) {
  const tone = progress.isSettled
    ? "success"
    : progress.overdue > 0
      ? "warning"
      : "primary";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {/*
          Each part is its own element rather than one interpolated string: a
          neutral separator between Persian text and a number is reordered by
          the bidi algorithm (see the accounts list for the bug this avoids).
        */}
        <span className="flex items-baseline gap-1.5 text-body font-medium">
          <span className="tabular">{progress.paid.toLocaleString("fa-IR")}</span>
          <span className="text-muted-foreground">از</span>
          <span className="tabular">{progress.total.toLocaleString("fa-IR")}</span>
          <span className="text-muted-foreground">قسط</span>
        </span>
        <span className="tabular text-caption text-muted-foreground" dir="ltr">
          {formatPercent(progress.ratio, { fractionDigits: 0 })}
        </span>
      </div>

      <Progress value={progress.paid} max={Math.max(progress.total, 1)} tone={tone} />

      {showAmounts ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption">
          <span className="flex items-baseline gap-2">
            <span className="text-muted-foreground">پرداخت‌شده</span>
            <Money rial={progress.paidAmount} unit={false} className="font-medium" />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-muted-foreground">باقی‌مانده</span>
            <Money
              rial={progress.remainingAmount}
              unit={false}
              className="font-medium"
            />
          </span>
        </div>
      ) : null}

      {progress.overdue > 0 ? (
        <p className="flex items-baseline gap-1.5 text-caption text-danger">
          <span className="tabular">{progress.overdue.toLocaleString("fa-IR")}</span>
          <span>قسط معوق</span>
        </p>
      ) : null}
    </div>
  );
}
