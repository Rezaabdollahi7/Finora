"use client";

import * as React from "react";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedList } from "@/components/common/animated-list";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { sumRial } from "@/utils/money";
import { type AccountDto, type Owner } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { LoanCard } from "@/features/loans/components/loan-card";
import { LoanDialog } from "@/features/loans/components/loan-dialog";
import type { LoanDto } from "@/features/loans/types";
import { useOwners } from "@/features/members/components/members-provider";

/**
 * The loans screen: total debt, an owner filter, the loans.
 *
 * The headline is what the household still owes, not what it borrowed.
 * Borrowed is history; owed is the number it plans around.
 *
 * Filtering happens on the client because the whole set is already here and a
 * household has a handful of loans — a round trip per tab would be slower and
 * would flash.
 */
export function LoanList({
  loans,
  accounts,
  categories,
  nowIso,
}: {
  loans: LoanDto[];
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  /** The server's "now", so the client renders the same statuses it did. */
  nowIso: string;
}) {
  const owners = useOwners();
  const [owner, setOwner] = React.useState<Owner | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const now = React.useMemo(() => new Date(nowIso), [nowIso]);

  const visible = React.useMemo(
    () => (owner === "ALL" ? loans : loans.filter((loan) => loan.owner === owner)),
    [loans, owner],
  );

  const totals = React.useMemo(() => {
    // Archived loans are out of play; a settled one owes nothing anyway.
    const live = visible.filter((loan) => loan.status !== "ARCHIVED");

    return {
      count: live.filter((loan) => loan.status === "ACTIVE").length,
      remaining: sumRial(
        live.map((loan) => BigInt(loan.progress.remainingAmount)),
      ).toString(),
      overdue: live.reduce((sum, loan) => sum + loan.progress.overdue, 0),
    };
  }, [visible]);

  const addButton = (
    <Button
      onClick={() => {
        setDialogOpen(true);
      }}
    >
      <Plus />
      ثبت وام
    </Button>
  );

  return (
    <div className="space-y-6">
      <HeroCard
        label={owner === "ALL" ? "مجموع بدهی" : `بدهی ${owners.label(owner)}`}
        icon={Landmark}
        value={totals.remaining}
        meta={<span>{totals.count.toLocaleString("fa-IR")} وام در جریان</span>}
        stats={
          totals.overdue > 0
            ? [
                {
                  label: "قسط معوق",
                  content: totals.overdue.toLocaleString("fa-IR"),
                  alert: true,
                },
              ]
            : undefined
        }
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
          icon={Landmark}
          title={loans.length === 0 ? "وامی ثبت نشده است" : "وامی برای این مالک نیست"}
          description={
            loans.length === 0
              ? "با ثبت وام، جدول اقساط آن ساخته می‌شود و سررسیدها در تقویم و پرداخت‌های پیش‌رو دیده می‌شوند."
              : "با انتخاب «همه» بقیه وام‌ها را ببینید، یا برای این مالک وامی ثبت کنید."
          }
          action={addButton}
        />
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((loan) => (
            <LoanCard key={loan.id} loan={loan} now={now} />
          ))}
        </AnimatedList>
      )}

      <LoanDialog
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
