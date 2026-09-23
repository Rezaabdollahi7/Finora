import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { CHART } from "@/components/charts/chart-tokens";
import { formatPercent } from "@/utils/number";
import { netWorthComposition, segmentWidths } from "@/features/dashboard/insights";
import { CardLink } from "@/features/dashboard/components/bento";
import { DeltaChip } from "@/features/dashboard/components/delta-chip";
import type { DashboardTotals } from "@/features/dashboard/types";

/**
 * Net worth and what it is made of (task 2.2).
 *
 * Two bars on one scale: what the household has — account balances and
 * assets — and, under it, what it owes, hatched. Net worth is the first
 * bar minus the second, which is exactly how the figure above them is
 * computed, so the picture and the number cannot disagree. Spelling the
 * formula out in the rows is what stops the total being read as a fourth
 * independent figure.
 */
export function NetWorthComposition({
  current,
  previous,
  className,
}: {
  current: DashboardTotals;
  previous: DashboardTotals;
  className?: string;
}) {
  const composition = netWorthComposition(current);
  const [balanceWidth = 0, assetWidth = 0] = segmentWidths(
    [composition.balanceShare, composition.assetShare],
    4,
  );
  const hasAnything = composition.gross > 0n || composition.liabilities > 0n;

  const rows = [
    {
      key: "balance",
      label: "موجودی حساب‌ها",
      value: current.totalBalance,
      swatch: CHART.categorical[0],
    },
    {
      key: "assets",
      label: "دارایی‌ها",
      value: current.assetValue,
      swatch: CHART.categorical[2],
    },
    {
      key: "liabilities",
      label: "بدهی‌ها",
      value: current.liabilityValue,
      swatch: null,
    },
  ];

  return (
    <Card variant="featured" className={cn("h-full gap-5 p-6", className)}>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>ارزش خالص</CardTitle>
          <Money
            rial={current.netWorth}
            className="truncate text-h1 font-light tracking-tight"
            tone={BigInt(current.netWorth) < 0n ? "negative" : "default"}
          />
          <DeltaChip
            value={current.netWorth}
            previous={previous.netWorth}
            goodWhen="up"
          />
        </div>
        <CardLink href="/reports" label="گزارش ارزش خالص" />
      </CardHeader>

      {hasAnything ? (
        <div
          className="flex flex-col gap-2"
          role="img"
          aria-label={`موجودی حساب‌ها ${formatPercent(composition.balanceShare, { fractionDigits: 0 })} و دارایی‌ها ${formatPercent(composition.assetShare, { fractionDigits: 0 })} از آنچه دارید؛ بدهی‌ها برابر ${formatPercent(composition.liabilityShare, { fractionDigits: 0 })} آن`}
        >
          <div className="flex h-4 gap-0.5">
            {balanceWidth > 0 ? (
              <span
                data-grow
                className="rounded-full"
                style={{
                  flex: `${balanceWidth} 1 0%`,
                  backgroundColor: CHART.categorical[0],
                }}
              />
            ) : null}
            {assetWidth > 0 ? (
              <span
                data-grow
                className="rounded-full"
                style={{
                  flex: `${assetWidth} 1 0%`,
                  backgroundColor: CHART.categorical[2],
                }}
              />
            ) : null}
          </div>
          <div className="flex h-4">
            <span
              data-grow
              className="rounded-full border border-border-strong bg-hatch"
              style={{
                width: `${Math.max(composition.liabilityShare * 100, composition.liabilities > 0n ? 3 : 0)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 text-body">
            <span
              aria-hidden
              className={cn(
                "size-3 shrink-0 rounded-full",
                row.swatch === null && "border border-border-strong bg-hatch",
              )}
              style={row.swatch ? { backgroundColor: row.swatch } : undefined}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {row.label}
            </span>
            <Money rial={row.value} className="shrink-0 font-medium" unit={false} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
