"use client";

import * as React from "react";
import { Gem, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedList } from "@/components/common/animated-list";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { sumRial } from "@/utils/money";
import { type Owner } from "@/features/accounts/types";
import { AssetCard } from "@/features/assets/components/asset-card";
import { AssetDialog } from "@/features/assets/components/asset-dialog";
import { AssetDistribution } from "@/features/assets/components/asset-distribution";
import { ProfitLoss } from "@/features/assets/components/profit-loss";
import { ratioOf } from "@/features/assets/valuation";
import type { AssetDto, PortfolioSummary } from "@/features/assets/types";
import { useOwners } from "@/features/members/components/members-provider";

/**
 * The portfolio screen (task 3.7): a total, the mix, an owner filter, the
 * holdings.
 *
 * Filtering happens on the client because the whole set is already here and a
 * household has a handful of assets, not thousands — a round trip per tab
 * would be slower and would flash.
 *
 * The totals recompute for the selected owner rather than staying fixed at
 * the household figure: a tab that changes the list but not the number above
 * it invites the number to be read as belonging to the list.
 */
export function AssetList({
  assets,
  summary,
}: {
  assets: AssetDto[];
  summary: PortfolioSummary;
}) {
  const owners = useOwners();
  const [owner, setOwner] = React.useState<Owner | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const visible = React.useMemo(
    () => (owner === "ALL" ? assets : assets.filter((asset) => asset.owner === owner)),
    [assets, owner],
  );

  // Only active assets count toward the total: an archived asset is one the
  // household no longer owns, and including it would overstate the portfolio.
  const totals = React.useMemo(() => {
    const held = visible.filter((asset) => asset.isActive);
    const value = sumRial(held.map((asset) => BigInt(asset.currentValue)));
    const cost = sumRial(held.map((asset) => BigInt(asset.purchaseTotal)));

    return {
      count: held.length,
      value: value.toString(),
      profitLoss: (value - cost).toString(),
      returnRatio: ratioOf(value - cost, cost),
    };
  }, [visible]);

  const addButton = (
    <Button
      onClick={() => {
        setDialogOpen(true);
      }}
    >
      <Plus />
      افزودن دارایی
    </Button>
  );

  return (
    <div className="space-y-6">
      <HeroCard
        label={
          owner === "ALL" ? "ارزش کل دارایی‌ها" : `دارایی‌های ${owners.label(owner)}`
        }
        icon={Gem}
        value={totals.value}
        meta={<span>{totals.count.toLocaleString("fa-IR")} دارایی</span>}
      >
        {/* Nothing held is not a profit of zero; it is no profit at all. */}
        {totals.count === 0 ? null : (
          <ProfitLoss
            rial={totals.profitLoss}
            ratio={totals.returnRatio}
            className="mt-1"
            surface="ink"
          />
        )}
      </HeroCard>

      {owner === "ALL" && summary.byType.length > 0 ? (
        <AssetDistribution shares={summary.byType} />
      ) : null}

      <Toolbar>
        {owners.enabled ? (
          <Tabs
            value={owner}
            onValueChange={(value) => {
              setOwner(value as Owner | "ALL");
            }}
          >
            <TabsList>
              <TabsTrigger value="ALL">همه</TabsTrigger>
              {owners.options.map(({ value: value }) => (
                <TabsTrigger key={value} value={value}>
                  {owners.label(value)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span aria-hidden />
        )}
        {addButton}
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState
          icon={Gem}
          title={
            assets.length === 0
              ? "هنوز دارایی‌ای ثبت نکرده‌اید"
              : "دارایی‌ای برای این مالک نیست"
          }
          description={
            assets.length === 0
              ? "طلا، ارز، خودرو یا ملک را اضافه کنید تا ارزش خالص شما کامل محاسبه شود. پول داخل حساب‌ها اینجا ثبت نمی‌شود؛ آن‌ها از قبل در موجودی حساب‌ها شمرده شده‌اند."
              : "با انتخاب «همه» بقیه دارایی‌ها را ببینید، یا برای این مالک دارایی اضافه کنید."
          }
          action={addButton}
        />
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </AnimatedList>
      )}

      <AssetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
