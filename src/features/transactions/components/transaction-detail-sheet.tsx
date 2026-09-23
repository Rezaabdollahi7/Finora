"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { formatJalaliDate } from "@/utils/date";
import { TransactionAmount } from "@/features/transactions/components/transaction-amount";
import { transactionTitle } from "@/features/transactions/components/transaction-badges";
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionDto,
} from "@/features/transactions/types";
import { useOwners } from "@/features/members/components/members-provider";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium">{children}</dd>
    </div>
  );
}

/**
 * Details for one transaction, with edit and delete.
 *
 * A sheet rather than a page: a ledger is scanned, and opening a row should
 * not lose the reader's place in a filtered list. On a phone it is a full
 * panel, which is what the design system prefers there (§33).
 */
export function TransactionDetailSheet({
  transaction,
  onEdit,
  onOpenChange,
}: {
  transaction: TransactionDto | null;
  onEdit: (transaction: TransactionDto) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  // Reset the confirmation on the event that closes the sheet rather than in
  // an effect watching the prop: the close is the cause, and doing it here
  // avoids an extra render pass.
  function handleOpenChange(open: boolean) {
    if (!open) setConfirming(false);
    onOpenChange(open);
  }

  async function remove() {
    if (!transaction) return;
    setPending(true);

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(payload?.error?.message ?? "حذف انجام نشد.");
        return;
      }

      toast.success("تراکنش حذف شد.");
      handleOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={transaction !== null} onOpenChange={handleOpenChange}>
      <SheetContent side="end" className="w-full sm:max-w-md">
        {transaction ? (
          <>
            <SheetHeader>
              <SheetTitle>{transactionTitle(transaction)}</SheetTitle>
              <SheetDescription>
                {TRANSACTION_TYPE_LABELS[transaction.type]}
              </SheetDescription>
            </SheetHeader>

            <TransactionAmount
              transaction={transaction}
              className="text-h1 font-light"
            />

            <dl>
              <Field label="حساب">{transaction.accountName}</Field>
              {transaction.toAccountName ? (
                <Field label="به حساب">{transaction.toAccountName}</Field>
              ) : null}
              <Field label="دسته‌بندی">
                {transaction.categoryName ?? (
                  <span className="text-muted-foreground">بدون دسته</span>
                )}
              </Field>
              <Field label="مالک">
                <Badge variant={transaction.owner === "SHARED" ? "default" : "neutral"}>
                  {owners.label(transaction.owner)}
                </Badge>
              </Field>
              <Field label="تاریخ">
                {formatJalaliDate(new Date(transaction.date), { style: "full" })}
              </Field>
              {transaction.description ? (
                <Field label="توضیح">{transaction.description}</Field>
              ) : null}
            </dl>

            <SheetFooter>
              {confirming ? (
                <div className="space-y-3">
                  <p className="text-body text-muted-foreground">
                    این تراکنش حذف شود؟ این کار قابل بازگشت نیست.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        void remove();
                      }}
                    >
                      {pending ? "در حال حذف…" : "بله، حذف کن"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setConfirming(false);
                      }}
                    >
                      انصراف
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onEdit(transaction);
                    }}
                  >
                    <Pencil />
                    ویرایش
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirming(true);
                    }}
                  >
                    <Trash2 />
                    حذف
                  </Button>
                </div>
              )}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
