import { ArrowDownLeft, ArrowUpRight, PiggyBank, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/common/money";
import { formatPercent } from "@/utils/number";
import { incomeSplit, segmentWidths } from "@/features/dashboard/insights";
import { DeltaChip } from "@/features/dashboard/components/delta-chip";
import type { DashboardPeriod, DashboardTotals } from "@/features/dashboard/types";

/**
 * The month at a glance, laid straight on the page rather than in a card
 * (§0.9): where this month's income went, as one row of pills, and the
 * three figures it is made of beside it.
 *
 * The pills answer "how much of what came in is left", which is the
 * question a household actually asks at a glance; the figures are the
 * exact amounts behind them, each with its change from last month.
 */
export function DashboardOverview({
  period,
  current,
  previous,
}: {
  period: DashboardPeriod;
  current: DashboardTotals;
  previous: DashboardTotals;
}) {
  return (
    <section
      aria-labelledby="overview-title"
      className="grid gap-8 xl:grid-cols-12 xl:items-end xl:gap-10"
    >
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-5">
        <div className="flex items-center gap-3">
          <h2 id="overview-title" className="text-h3">
            وضعیت مالی
          </h2>
          <Badge variant="outline">{period.label}</Badge>
        </div>
        <IncomeSplitBar
          income={current.monthlyIncome}
          expenses={current.monthlyExpenses}
        />
      </div>

      <ul className="grid gap-6 sm:grid-cols-3 xl:col-span-7">
        <Figure
          icon={ArrowDownLeft}
          label="درآمد ماه"
          value={current.monthlyIncome}
          previous={previous.monthlyIncome}
          goodWhen="up"
        />
        <Figure
          icon={ArrowUpRight}
          label="هزینه ماه"
          value={current.monthlyExpenses}
          previous={previous.monthlyExpenses}
          goodWhen="down"
        />
        <Figure
          icon={PiggyBank}
          label="پس‌انداز ماه"
          value={current.monthlySavings}
          previous={previous.monthlySavings}
          goodWhen="up"
        />
      </ul>
    </section>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  previous,
  goodWhen,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  previous: string;
  goodWhen: "up" | "down";
}) {
  return (
    <li className="flex min-w-0 flex-col gap-2" aria-label={label}>
      <span className="flex items-center gap-2 text-body text-muted-foreground">
        <span className="flex size-8 items-center justify-center rounded-full bg-card-solid shadow-sm">
          <Icon aria-hidden className="size-4" />
        </span>
        {label}
      </span>
      <Money
        rial={value}
        // One size down between sm and 2xl, where three full Toman figures
        // share a row: a truncated amount is worse than a smaller one.
        className="truncate text-h1 font-light tracking-tight sm:text-h2 2xl:text-h1"
        tone={BigInt(value) < 0n ? "negative" : "default"}
      />
      <DeltaChip value={value} previous={previous} goodWhen={goodWhen} />
    </li>
  );
}

/** One pill of the bar, with its label above it as in the reference. */
type Pill = {
  key: string;
  label: string;
  share: number;
  text: string;
  className: string;
};

/**
 * Where this month's income went, as a row of pills.
 *
 * Ink for what was spent, the warm highlight for what was kept. Overspent,
 * the bar becomes the month's spending instead: the part income covered,
 * then the part it did not, in the danger colour and named in words. With
 * nothing recorded the bar is a hatched placeholder that says why.
 */
function IncomeSplitBar({ income, expenses }: { income: string; expenses: string }) {
  const split = incomeSplit(income, expenses);

  if (split.kind === "empty" || split.kind === "no-income") {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-body text-muted-foreground">
          {split.kind === "empty"
            ? "سهم هزینه و پس‌انداز از درآمد"
            : "هزینه بدون درآمد"}
        </span>
        <p
          className={cn(
            "flex h-12 items-center rounded-full border border-border-strong px-5 text-body",
            split.kind === "empty"
              ? "bg-hatch text-muted-foreground"
              : "bg-danger-subtle text-danger",
          )}
        >
          {split.kind === "empty"
            ? "هنوز درآمد یا هزینه‌ای برای این ماه ثبت نشده"
            : "این ماه درآمدی ثبت نشده و همه هزینه‌ها کسری است"}
        </p>
      </div>
    );
  }

  const pills: Pill[] =
    split.kind === "surplus"
      ? [
          {
            key: "spent",
            label: "هزینه",
            share: split.expenseShare,
            text: formatPercent(split.expenseShare, { fractionDigits: 0 }),
            // Inverted in the dark theme, where an ink pill would sink into
            // the page: the reference's dark pill on light, turned around.
            className:
              "bg-ink-surface text-ink-surface-foreground dark:bg-foreground dark:text-background",
          },
          {
            key: "saved",
            label: "پس‌انداز",
            share: split.savingsShare,
            text: formatPercent(split.savingsShare, { fractionDigits: 0 }),
            className: "bg-highlight text-highlight-foreground",
          },
        ]
      : [
          {
            key: "covered",
            label: "پوشش با درآمد",
            share: 1,
            text: formatPercent(1, { fractionDigits: 0 }),
            className:
              "bg-ink-surface text-ink-surface-foreground dark:bg-foreground dark:text-background",
          },
          {
            key: "deficit",
            label: "کسری",
            share: split.overspend,
            text: `+${formatPercent(split.overspend, { fractionDigits: 0 })}`,
            className: "bg-danger text-danger-foreground",
          },
        ];

  const visible = pills.filter((pill) => pill.share > 0);
  const widths = segmentWidths(
    visible.map((pill) => pill.share),
    14,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1" role="img" aria-label={describe(split.kind, visible)}>
        {visible.map((pill, index) => (
          <div
            key={pill.key}
            className="flex min-w-0 flex-col gap-2"
            // Grow factors rather than percentage widths, so the gaps between
            // pills come out of the bar instead of overflowing it.
            style={{ flex: `${widths[index]} 1 0%` }}
          >
            <span aria-hidden className="truncate text-body text-muted-foreground">
              {pill.label}
            </span>
            <span
              aria-hidden
              data-grow
              className={cn(
                "flex h-12 items-center rounded-full px-4 text-body font-medium",
                pill.className,
              )}
            >
              <span className="tabular truncate" dir="ltr">
                {pill.text}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function describe(kind: "surplus" | "deficit", pills: Pill[]): string {
  const parts = pills.map((pill) => `${pill.label} ${pill.text}`).join("، ");
  return kind === "surplus"
    ? `سهم از درآمد این ماه: ${parts}`
    : `هزینه‌های این ماه بیش از درآمد: ${parts}`;
}
