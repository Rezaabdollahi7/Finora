"use client";

import * as React from "react";
import { Plus, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { Card } from "@/components/ui/card";
import { sumRial } from "@/utils/money";
import { AccountCard } from "@/features/accounts/components/account-card";
import { AccountDialog } from "@/features/accounts/components/account-dialog";
import {
  OWNERS,
  OWNER_LABELS,
  type AccountDto,
  type Owner,
} from "@/features/accounts/types";

/**
 * The accounts screen: a household total, an owner filter, and the grid.
 *
 * Filtering happens on the client because the whole set is already here and
 * a household has a handful of accounts, not thousands — a round trip per
 * tab would be slower and would flash. Sprint 1.8 introduces server-side
 * filtering where the data volume actually needs it.
 */
function AccountList({ accounts }: { accounts: AccountDto[] }) {
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
      <Card variant="ink" padding="large" className="gap-2">
        <span className="text-body text-ink-surface-muted">
          {owner === "ALL" ? "موجودی کل" : `موجودی ${OWNER_LABELS[owner]}`}
        </span>
        <Money rial={total} className="text-h1 sm:text-display" unit={false} />
        {/*
          Each part is its own element rather than one interpolated string.
          A neutral separator sitting between Persian text and a number is
          reordered by the bidi algorithm, which rendered this line as
          "تومان ۲ ·" instead of "تومان · ۲".
        */}
        <span className="flex items-center gap-2 text-caption text-ink-surface-subtle">
          <span>تومان</span>
          <span aria-hidden>·</span>
          <span>
            {visible.filter((a) => a.isActive).length.toLocaleString("fa-IR")} حساب فعال
          </span>
        </span>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          value={owner}
          onValueChange={(value) => {
            setOwner(value as Owner | "ALL");
          }}
        >
          <TabsList>
            <TabsTrigger value="ALL">همه</TabsTrigger>
            {OWNERS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {OWNER_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {addButton}
      </div>

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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((account) => (
            <li key={account.id} className="contents">
              <AccountCard account={account} />
            </li>
          ))}
        </ul>
      )}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export { AccountList };
