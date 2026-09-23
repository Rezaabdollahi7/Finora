"use client";

import * as React from "react";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedList } from "@/components/common/animated-list";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard, type HeroStat } from "@/components/common/hero-card";
import { Toolbar } from "@/components/common/toolbar";
import { sumRial } from "@/utils/money";
import { AccountCard } from "@/features/accounts/components/account-card";
import { AccountDialog } from "@/features/accounts/components/account-dialog";
import { type AccountDto, type Owner } from "@/features/accounts/types";
import { useOwners } from "@/features/members/components/members-provider";

/**
 * The accounts screen: a household total, an owner filter, and the grid.
 *
 * Filtering happens on the client because the whole set is already here and
 * a household has a handful of accounts, not thousands — a round trip per
 * tab would be slower and would flash. Sprint 1.8 introduces server-side
 * filtering where the data volume actually needs it.
 */
function AccountList({ accounts }: { accounts: AccountDto[] }) {
  const owners = useOwners();
  const [owner, setOwner] = React.useState<Owner | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const visible = React.useMemo(
    () => (owner === "ALL" ? accounts : accounts.filter((a) => a.owner === owner)),
    [accounts, owner],
  );

  // Only active accounts count toward the household total: an archived
  // account is out of play, and including it would overstate what is
  // actually spendable.
  const total = React.useMemo(
    () =>
      sumRial(
        visible.filter((a) => a.isActive).map((a) => BigInt(a.balance)),
      ).toString(),
    [visible],
  );

  // With every owner showing, the hero breaks the total down by owner; with
  // one selected, the breakdown would be the total again, so it is omitted.
  const stats: HeroStat[] | undefined =
    owner === "ALL" && owners.enabled
      ? owners.options.map(({ value: value }) => ({
          label: owners.label(value),
          rial: sumRial(
            accounts
              .filter((a) => a.isActive && a.owner === value)
              .map((a) => BigInt(a.balance)),
          ).toString(),
        }))
      : undefined;
  const activeCount = visible.filter((a) => a.isActive).length;

  const addButton = (
    <Button
      onClick={() => {
        setDialogOpen(true);
      }}
    >
      <Plus />
      افزودن حساب
    </Button>
  );

  return (
    <div className="space-y-6">
      <HeroCard
        label={owner === "ALL" ? "موجودی کل" : `موجودی ${owners.label(owner)}`}
        icon={Wallet}
        value={total}
        negative={BigInt(total) < 0n}
        meta={<span>{activeCount.toLocaleString("fa-IR")} حساب فعال</span>}
        stats={stats}
      />

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
          icon={Wallet}
          title={
            accounts.length === 0
              ? "هنوز حسابی اضافه نکرده‌اید"
              : "حسابی برای این مالک نیست"
          }
          description={
            accounts.length === 0
              ? "اولین حساب بانکی یا کیف پول خود را اضافه کنید تا بتوانید تراکنش‌ها را ثبت کنید."
              : "با انتخاب «همه» بقیه حساب‌ها را ببینید، یا برای این مالک حسابی اضافه کنید."
          }
          action={addButton}
        />
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </AnimatedList>
      )}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export { AccountList };
