"use client";

import { Wallet } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { CHART } from "@/components/charts/chart-primitives";
import { formatPercent } from "@/utils/number";
import { sumRial } from "@/utils/money";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/features/accounts/types";
import type { AccountShare } from "@/features/dashboard/types";

/**
 * Where the household's liquid money sits right now (task 2.5).
 *
 * A single stacked bar, which is the part-to-whole form: the reader's
 * question is "how is it split", and one bar answers that in a glance where
 * several separate bars would ask them to add up. Segments are separated by
 * a 2px gap in the surface colour rather than by strokes (§59.4).
 *
 * The same sequential ramp as the expense chart, largest first, so the two
 * cards read as one system rather than two palettes.
 */

const MAX_SEGMENTS = 6;

type Segment = AccountShare & { color: string; percent: number };

function toSegments(shares: AccountShare[]): Segment[] {
  // Only accounts actually holding money can take up width; an overdrawn
  // one has a real balance but no share of the pot.
  const funded = shares.filter((entry) => BigInt(entry.balance) > 0n);
  const head = funded.slice(0, MAX_SEGMENTS - 1);
  const tail = funded.slice(MAX_SEGMENTS - 1);

  const combined: AccountShare[] =
    tail.length > 1
      ? [
          ...head,
          {
            accountId: "__rest__",
            name: "سایر حساب‌ها",
            type: "OTHER",
            owner: "SHARED",
            balance: sumRial(tail.map((entry) => BigInt(entry.balance))).toString(),
            share: tail.reduce((sum, entry) => sum + entry.share, 0),
          },
        ]
      : funded;

  return combined.map((entry, index) => ({
    ...entry,
    color:
      CHART.sequential[Math.min(index, CHART.sequential.length - 1)] ?? CHART.neutral,
    percent: Math.max(entry.share * 100, 1.5),
  }));
}

export function AccountDistribution({ shares }: { shares: AccountShare[] }) {
  const segments = toSegments(shares);
  const total = sumRial(
    shares.map((entry) => BigInt(entry.balance)).filter((balance) => balance > 0n),
  );

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>توزیع موجودی</CardTitle>
          <CardDescription>پول نقد و بانکی بین حساب‌ها</CardDescription>
        </div>
        {segments.length > 0 ? (
          <div className="text-end">
            <Money rial={total.toString()} className="text-h3 font-bold" unit={false} />
            <p className="text-caption text-muted-foreground">تومان</p>
          </div>
        ) : null}
      </CardHeader>

      {segments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="موجودی قابل تقسیمی نیست"
          description="وقتی حسابی موجودی مثبت داشته باشد، سهم هر کدام اینجا دیده می‌شود."
        />
      ) : (
        <>
          <div
            className="flex h-4 w-full gap-0.5 overflow-hidden"
            role="img"
            aria-label={`توزیع موجودی بین ${segments.length.toLocaleString("fa-IR")} حساب`}
          >
            {segments.map((segment, index) => (
              <span
                key={segment.accountId}
                className={
                  index === 0
                    ? "rounded-s-full"
                    : index === segments.length - 1
                      ? "rounded-e-full"
                      : undefined
                }
                style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
              />
            ))}
          </div>

          <ul className="space-y-3">
            {segments.map((segment) => (
              <li key={segment.accountId} className="flex items-center gap-3 text-body">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{segment.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {ACCOUNT_TYPE_LABELS[segment.type as AccountType] ?? segment.type}
                  </span>
                </span>
                <span
                  className="tabular ms-auto shrink-0 text-caption text-text-muted"
                  dir="ltr"
                >
                  {formatPercent(segment.share, { fractionDigits: 0 })}
                </span>
                <Money
                  rial={segment.balance}
                  className="shrink-0 font-medium"
                  unit={false}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
