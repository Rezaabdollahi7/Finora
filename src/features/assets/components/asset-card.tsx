import Link from "next/link";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatQuantity } from "@/utils/quantity";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { ASSET_TYPE_ICONS } from "@/features/assets/format";
import { ProfitLoss } from "@/features/assets/components/profit-loss";
import { ASSET_TYPE_LABELS, type AssetDto } from "@/features/assets/types";

/**
 * One holding in the portfolio.
 *
 * The current value dominates, the holding and type sit under it, and the
 * profit or loss closes the card — the hierarchy the design system asks for
 * (§1.3). The whole card is the link, so the tap target on a phone is the
 * card and not a word inside it (rule G.10).
 */
export function AssetCard({ asset }: { asset: AssetDto }) {
  const Icon = ASSET_TYPE_ICONS[asset.type];

  return (
    <Card
      padding="none"
      className={cn("hover-lift h-full", !asset.isActive && "opacity-70")}
    >
      <Link
        href={`/assets/${asset.id}`}
        className="flex h-full flex-col gap-5 rounded-xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{asset.name}</span>
              <span className="text-caption text-muted-foreground">
                {ASSET_TYPE_LABELS[asset.type]}
              </span>
            </span>
          </span>
          <OwnerBadge owner={asset.owner} />
        </div>

        <Money
          rial={asset.currentValue}
          className="text-h2 font-light tracking-tight"
        />

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <ProfitLoss rial={asset.profitLoss} ratio={asset.returnRatio} />
          {asset.unit ? (
            // The quantity is its own isolated run: a Latin number sitting
            // between Persian words is reordered by the bidi algorithm, which
            // is what renders "18.5 گرم" as "گرم 18.5".
            <span className="ms-auto flex items-center gap-1 text-caption text-muted-foreground">
              <span className="tabular" dir="ltr">
                {formatQuantity(BigInt(asset.quantity))}
              </span>
              <span>{asset.unit}</span>
            </span>
          ) : null}
          {!asset.isActive ? (
            <Badge variant="outline" className="ms-auto">
              بایگانی‌شده
            </Badge>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}
