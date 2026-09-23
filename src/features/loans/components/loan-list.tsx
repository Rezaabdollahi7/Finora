"use client";

import * as React from "react";
import { Landmark, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { sumRial } from "@/utils/money";
import {
  OWNERS,
  OWNER_LABELS,
  type AccountDto,
  type Owner,
} from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { LoanCard } from "@/features/loans/components/loan-card";
import { LoanDialog } from "@/features/loans/components/loan-dialog";
import type { LoanDto } from "@/features/loans/types";

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
      <Card variant="ink" padding="large" className="gap-2">
        <span className="text-body text-ink-surface-muted">
          {owner === "ALL" ? "مجموع بدهی" : `بدهی ${OWNER_LABELS[owner]}`}
        </span>
        <Money
          rial={totals.remaining}
          className="text-h1 sm:text-display"
          unit={false}
        />
        {/*
          Each part is its own element: a neutral separator between Persian
          text and a number is reordered by the bidi algorithm.
        */}
        <span className="flex items-center gap-2 text-caption text-ink-surface-subtle">
          <span>تومان</span>
          <span aria-hidden>·</span>
          <span>{totals.count.toLocaleString("fa-IR")} وام در جریان</span>
        </span>
        {totals.overdue > 0 ? (
          <span className="mt-2 flex items-center gap-1.5 text-caption text-danger">
            <span className="tabular">{totals.overdue.toLocaleString("fa-IR")}</span>
            <span>قسط معوق</span>
          </span>
        ) : null}
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((loan) => (
            <li key={loan.id} className="contents">
              <LoanCard loan={loan} now={now} />
            </li>
          ))}
        </ul>
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
