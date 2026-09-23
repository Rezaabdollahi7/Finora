import {
  ArrowDownLeft,
  ArrowUpRight,
  Gem,
  Landmark,
  Minus,
  PiggyBank,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/common/money";
import { formatPercent } from "@/utils/number";
import type { DashboardTotals } from "@/features/dashboard/types";

/**
 * The headline figures (task 2.2).
 *
 * A stat tile rather than a one-bar chart: a single current value with a
 * comparison is not chart-shaped. The value dominates, the comparison sits
 * under it, and the label sits above — the hierarchy the design system asks
 * for (§1.3, §28).
 */

type Tone = "neutral" | "ink";

type Metric = {
  key: string;
  label: string;
  icon: LucideIcon;
  value: string;
  previous: string;
  /** Which direction is good, for reading the comparison. */
  goodWhen: "up" | "down" | "either";
  tone: Tone;
  hint?: string;
  /** Spans the whole row: for a figure that totals the ones above it. */
  wide?: boolean;
};

function buildMetrics(current: DashboardTotals, previous: DashboardTotals): Metric[] {
  return [
    {
      key: "totalBalance",
      label: "موجودی کل",
      icon: Wallet,
      value: current.totalBalance,
      previous: previous.totalBalance,
      goodWhen: "up",
      tone: "ink",
    },
    {
      key: "monthlyIncome",
      label: "درآمد ماه",
      icon: ArrowDownLeft,
      value: current.monthlyIncome,
      previous: previous.monthlyIncome,
      goodWhen: "up",
      tone: "neutral",
    },
    {
      key: "monthlyExpenses",
      label: "هزینه ماه",
      icon: ArrowUpRight,
      value: current.monthlyExpenses,
      previous: previous.monthlyExpenses,
      goodWhen: "down",
      tone: "neutral",
    },
    {
      key: "monthlySavings",
      label: "پس‌انداز ماه",
      icon: PiggyBank,
      value: current.monthlySavings,
      previous: previous.monthlySavings,
      goodWhen: "up",
      tone: "neutral",
    },
    {
      key: "assetValue",
      label: "دارایی‌ها",
      icon: Gem,
      value: current.assetValue,
      previous: previous.assetValue,
      goodWhen: "up",
      tone: "neutral",
      hint: "طلا، ارز، خودرو و ملک — پول داخل حساب‌ها اینجا شمرده نمی‌شود",
    },
    {
      key: "liabilityValue",
      label: "بدهی",
      icon: Landmark,
      value: current.liabilityValue,
      previous: previous.liabilityValue,
      goodWhen: "down",
      tone: "neutral",
      hint: "مجموع اقساط پرداخت‌نشده وام‌ها",
    },
    /*
     * Net worth closes the row rather than sitting among the figures it is
     * made of. Six tiles fill two rows of three and the seventh would be
     * stranded alone; spanning it instead makes the odd one out read as the
     * total it is. Four columns would fit seven, but a thirteen-digit figure
     * does not fit a quarter of 1280px — the browser check measures that.
     */
    {
      key: "netWorth",
      label: "ارزش خالص",
      icon: Scale,
      value: current.netWorth,
      previous: previous.netWorth,
      goodWhen: "up",
      tone: "neutral",
      wide: true,
      // Spelling out the formula is what stops the figure being read as a
      // seventh independent number beside the six it is made of.
      hint: "دارایی‌ها + موجودی حساب‌ها − بدهی‌ها",
    },
  ];
}

/**
 * Month-over-month change.
 *
 * Returns null when there is nothing honest to say: with no figure last month
 * there is no percentage, and "∞٪ رشد" is noise rather than information.
 */
function change(value: string, previous: string) {
  const now = BigInt(value);
  const before = BigInt(previous);

  if (before === 0n) return null;

  const delta = now - before;
  if (delta === 0n) return { direction: "flat" as const, ratio: 0 };

  // A ratio is a display value, so a float is fine; the amounts beside it
  // stay exact.
  const ratio = Number(delta) / Math.abs(Number(before));

  return { direction: delta > 0n ? ("up" as const) : ("down" as const), ratio };
}

function Comparison({ metric }: { metric: Metric }) {
  const result = change(metric.value, metric.previous);

  if (!result) {
    return (
      <p className="text-caption text-muted-foreground">
        {metric.hint ?? "ماه قبل داده‌ای نیست"}
      </p>
    );
  }

  const { direction, ratio } = result;
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  // "Good" depends on the metric: spending less is an improvement, earning
  // less is not. Colouring by direction alone would call a fall in expenses
  // a bad month.
  const good =
    metric.goodWhen === "either"
      ? null
      : (direction === "up") === (metric.goodWhen === "up");

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-caption",
        metric.tone === "ink"
          ? "text-ink-surface-muted"
          : good === null
            ? "text-muted-foreground"
            : good
              ? "text-success"
              : "text-danger",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className="tabular" dir="ltr">
        {formatPercent(Math.abs(ratio), { fractionDigits: 1 })}
      </span>
      <span className={metric.tone === "ink" ? undefined : "text-muted-foreground"}>
        نسبت به ماه قبل
      </span>
    </p>
  );
}

export function SummaryCards({
  current,
  previous,
}: {
  current: DashboardTotals;
  previous: DashboardTotals;
}) {
  const metrics = buildMetrics(current, previous);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <li key={metric.key} className="contents">
          <Card
            variant={metric.tone === "ink" ? "ink" : "default"}
            className={cn("gap-3", metric.wide && "sm:col-span-2 xl:col-span-3")}
            aria-label={metric.label}
          >
            <span
              className={cn(
                "flex items-center gap-2 text-body",
                metric.tone === "ink"
                  ? "text-ink-surface-muted"
                  : "text-muted-foreground",
              )}
            >
              <metric.icon aria-hidden className="size-[18px]" />
              {metric.label}
            </span>
            <Money rial={metric.value} className="text-h1 font-bold" />
            <Comparison metric={metric} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

/**
 * Built from the same Card and the same three rows as the real thing, rather
 * than from a guessed height, so the geometry cannot drift out of step and
 * nothing shifts when the data arrives (design system §36).
 */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-32" />
        </Card>
      ))}
    </div>
  );
}
