import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { monthPace } from "@/features/dashboard/insights";
import { CardLink } from "@/features/dashboard/components/bento";
import type { DashboardPeriod } from "@/features/dashboard/types";

/**
 * The month's pace, as a dial (§31 progress) — the reference boards' time
 * tracker, turned to money.
 *
 * The arc is how far into the Jalali month the household is; the figure
 * under it is what this month has left over so far, spread across the days
 * still to come: spend less than this each day and the month ends even. A
 * single ratio against a limit is gauge-shaped rather than chart-shaped,
 * so this is SVG rather than Recharts. The arc sweeps in on load
 * (bento.tsx).
 */

// 270° of a circle, open at the bottom.
const ARC = "M50.5 149.5A70 70 0 1 1 149.5 149.5";

export function MonthPace({
  period,
  savings,
  className,
}: {
  period: DashboardPeriod;
  savings: string;
  className?: string;
}) {
  const pace = monthPace(period, savings);
  const inDeficit = pace.left < 0n;

  return (
    <Card variant="featured" className={cn("h-full gap-4 p-6", className)}>
      <CardHeader>
        <CardTitle>ریتم ماه</CardTitle>
        <CardLink href="/calendar" label="تقویم مالی" />
      </CardHeader>

      <div className="flex flex-1 flex-col items-center gap-4">
        <div className="relative w-full max-w-56">
          <svg
            viewBox="0 0 200 180"
            className="w-full"
            role="img"
            aria-label={`روز ${pace.day.toLocaleString("fa-IR")} از ${pace.length.toLocaleString("fa-IR")} روز ${period.label}`}
          >
            {/* The dotted scale around the dial. */}
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              strokeWidth="6"
              strokeDasharray="1.2 6"
              strokeLinecap="round"
              className="stroke-border-strong"
            />
            <path
              d={ARC}
              fill="none"
              strokeWidth="16"
              strokeLinecap="round"
              className="stroke-muted"
            />
            <path
              d={ARC}
              fill="none"
              strokeWidth="16"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              data-sweep
              style={{ strokeDashoffset: 1 - pace.progress }}
              className="stroke-highlight"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-caption text-muted-foreground">روز</span>
            <span className="text-display leading-none font-light tracking-tight">
              {pace.day.toLocaleString("fa-IR")}
            </span>
            <span className="text-caption text-muted-foreground">
              از {pace.length.toLocaleString("fa-IR")} روز
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-1 text-center">
          {inDeficit || pace.perDay === 0n ? (
            <p
              className={cn(
                "text-body",
                inDeficit ? "text-danger" : "text-muted-foreground",
              )}
            >
              {inDeficit
                ? "خرج این ماه از درآمدش گذشته است"
                : "هنوز چیزی از درآمد این ماه نمانده"}
            </p>
          ) : (
            <>
              <span className="text-caption text-muted-foreground">
                مانده برای هر روز، تا آخر ماه
              </span>
              <Money rial={pace.perDay.toString()} className="text-h3 font-medium" />
            </>
          )}
          <span className="text-caption text-text-muted">
            {pace.remainingDays.toLocaleString("fa-IR")} روز باقی مانده
          </span>
        </div>
      </div>
    </Card>
  );
}
