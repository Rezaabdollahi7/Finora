"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import type { AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { RecurringDialog } from "@/features/recurring/components/recurring-dialog";
import type { RecurringPaymentDto } from "@/features/recurring/types";

/**
 * Edit, and switch the rule on or off, for a single recurring payment.
 *
 * There is no delete. The expenses this rule's payments created are real
 * transactions, and removing the rule would leave them unexplained (rule
 * G.4); switching it off stops the future without touching the past.
 */
export function RecurringActions({
  payment,
  accounts,
  categories,
}: {
  payment: RecurringPaymentDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function setActive(isActive: boolean) {
    setPending(true);

    try {
      const response = await fetch(`/api/recurring/${payment.id}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success(isActive ? "پرداخت دوباره فعال شد." : "پرداخت غیرفعال شد.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        <Pencil />
        ویرایش
      </Button>

      {payment.isActive ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void setActive(false);
          }}
        >
          <Pause />
          غیرفعال کردن
        </Button>
      ) : (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void setActive(true);
          }}
        >
          <Play />
          فعال کردن
        </Button>
      )}

      <RecurringDialog
        payment={payment}
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
