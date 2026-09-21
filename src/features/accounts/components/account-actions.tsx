"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AccountDialog } from "@/features/accounts/components/account-dialog";
import type { AccountDto } from "@/features/accounts/types";

/** Edit, archive and restore for a single account. */
function AccountActions({ account }: { account: AccountDto }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function call(action: "archive" | "restore") {
    setPending(true);

    try {
      const response = await fetch(`/api/accounts/${account.id}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(payload?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success(action === "archive" ? "حساب بایگانی شد." : "حساب بازگردانده شد.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        disabled={!account.isActive}
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        <Pencil />
        ویرایش
      </Button>

      {account.isActive ? (
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
      ) : (
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
      )}

      <AccountDialog account={account} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

export { AccountActions };
