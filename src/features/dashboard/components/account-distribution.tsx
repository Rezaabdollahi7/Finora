import { Wallet } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { CHART } from "@/components/charts/chart-tokens";
import { formatPercent } from "@/utils/number";
import { sumRial } from "@/utils/money";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/features/accounts/types";
import { segmentWidths } from "@/features/dashboard/insights";
import { CardLink } from "@/features/dashboard/components/bento";
import type { AccountShare } from "@/features/dashboard/types";

/**
 * Where the household's liquid money sits right now (task 2.5).
 *
 * A single stacked bar of pills, which is the part-to-whole form: the
 * reader's question is "how is it split", and one bar answers that at a
 * glance where several separate bars would ask them to add up. Each share
 * is labelled above its pill, as in the reference boards, and each account
 * is an identity, so it takes a categorical hue in the validated order.
 * The tiles under the bar carry the exact balances.
 */

const MAX_SEGMENTS = 6;

type Segment = AccountShare & { color: string };

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
      entry.accountId === "__rest__"
        ? CHART.neutral
        : (CHART.categorical[index] ?? CHART.neutral),
  }));
}

export function AccountDistribution({ shares }: { shares: AccountShare[] }) {
  const segments = toSegments(shares);
  const widths = segmentWidths(
    segments.map((segment) => segment.share),
    6,
  );
  const total = sumRial(
    shares.map((entry) => BigInt(entry.balance)).filter((balance) => balance > 0n),
  );

  return (
    <Card variant="featured" className="h-full gap-6 p-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>توزیع موجودی</CardTitle>
          <CardDescription>پول نقد و بانکی بین حساب‌ها</CardDescription>
        </div>
        <div className="flex items-center gap-4">
          {segments.length > 0 ? (
            <div className="hidden text-end sm:block">
              <Money
                rial={total.toString()}
                className="text-h3 font-light"
                unit={false}
              />
              <p className="text-caption text-muted-foreground">تومان</p>
            </div>
          ) : null}
          <CardLink href="/accounts" label="حساب‌ها" />
        </div>
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
            className="flex gap-1"
            role="img"
            aria-label={`توزیع موجودی بین ${segments.length.toLocaleString("fa-IR")} حساب`}
          >
            {segments.map((segment, index) => (
              <div
                key={segment.accountId}
                className="flex min-w-0 flex-col gap-2"
                style={{ flex: `${widths[index] ?? 0} 1 0%` }}
              >
                <span
                  aria-hidden
                  className="tabular truncate text-caption text-muted-foreground"
                  dir="ltr"
                >
                  {formatPercent(segment.share, { fractionDigits: 0 })}
                </span>
                <span
                  aria-hidden
                  data-grow
                  className="h-10 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
              </div>
            ))}
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {segments.map((segment) => (
              <li
                key={segment.accountId}
                className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 text-body"
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{segment.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {ACCOUNT_TYPE_LABELS[segment.type as AccountType] ?? segment.type}
                  </span>
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
