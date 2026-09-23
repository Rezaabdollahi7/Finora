"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import type { AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { TransactionDetailSheet } from "@/features/transactions/components/transaction-detail-sheet";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import { TransactionFilters } from "@/features/transactions/components/transaction-filters";
import {
  TransactionCard,
  TransactionRow,
} from "@/features/transactions/components/transaction-row";
import type { TransactionDto } from "@/features/transactions/types";

export type TransactionListProps = {
  transactions: TransactionDto[];
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  page: number;
  totalPages: number;
  total: number;
  /** True when any filter is applied, which changes what "empty" means. */
  filtered: boolean;
};

export function TransactionList({
  transactions,
  accounts,
  categories,
  page,
  totalPages,
  total,
  filtered,
}: TransactionListProps) {
  const [selected, setSelected] = React.useState<TransactionDto | null>(null);
  const [editing, setEditing] = React.useState<TransactionDto | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const openNew = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (transaction: TransactionDto) => {
    setSelected(null);
    setEditing(transaction);
    setDialogOpen(true);
  };

  const canRecord = accounts.some((account) => account.isActive);

  return (
    <div className="space-y-6">
      <Toolbar>
        <TransactionFilters accounts={accounts} categories={categories} total={total} />
        <Button onClick={openNew} disabled={!canRecord}>
          <Plus />
          ثبت تراکنش
        </Button>
      </Toolbar>

      {transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={filtered ? "تراکنشی با این فیلترها نیست" : "هنوز تراکنشی ثبت نشده"}
          description={
            filtered
              ? "فیلترها را تغییر دهید یا پاک کنید تا نتایج بیشتری ببینید."
              : canRecord
                ? "اولین درآمد یا هزینه خود را ثبت کنید تا گزارش‌های مالی شکل بگیرند."
                : "برای ثبت تراکنش، ابتدا یک حساب فعال اضافه کنید."
          }
          action={
            canRecord && !filtered ? (
              <Button onClick={openNew}>ثبت تراکنش</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* A financial table is unreadable on a phone, so below `md` the
              same rows render as cards instead of forcing a zoom (G.10). */}
          <div className="grid gap-3 md:hidden">
            {transactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onSelect={setSelected}
              />
            ))}
          </div>

          <Card padding="none" className="reveal hidden p-2 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شرح</TableHead>
                  <TableHead>حساب</TableHead>
                  <TableHead>مالک</TableHead>
                  <TableHead>تاریخ</TableHead>
                  <TableHead className="text-end">مبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onSelect={setSelected}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>

          <Pagination page={page} totalPages={totalPages} />
        </>
      )}

      <TransactionDetailSheet
        transaction={selected}
        onEdit={openEdit}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      <TransactionDialog
        transaction={editing}
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const go = (target: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(target));
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <nav
      aria-label="صفحه‌بندی"
      className="flex items-center justify-between gap-4 pt-2"
    >
      {/* In RTL "previous" is to the right, so the chevrons point the way
          the list actually moves. */}
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => {
          go(page - 1);
        }}
      >
        <ChevronRight />
        قبلی
      </Button>

      <span className="text-caption text-muted-foreground">
        صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
      </span>

      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => {
          go(page + 1);
        }}
      >
        بعدی
        <ChevronLeft />
      </Button>
    </nav>
  );
}
