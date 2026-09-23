"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import type { AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { LoanDialog } from "@/features/loans/components/loan-dialog";
import type { LoanDto } from "@/features/loans/types";

/** Edit, archive and restore, for a single loan. */
export function LoanActions({
  loan,
  accounts,
  categories,
}: {
  loan: LoanDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const archived = loan.status === "ARCHIVED";

  async function call(action: "archive" | "restore") {
    setPending(true);

    try {
      const response = await fetch(`/api/loans/${loan.id}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(payload?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success(action === "archive" ? "وام بایگانی شد." : "وام بازگردانده شد.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        disabled={archived}
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        <Pencil />
        ویرایش
      </Button>

      {archived ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void call("restore");
          }}
        >
          <ArchiveRestore />
          خروج از بایگانی
        </Button>
      ) : (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void call("archive");
          }}
        >
          <Archive />
          بایگانی
        </Button>
      )}

      <LoanDialog
        loan={loan}
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
