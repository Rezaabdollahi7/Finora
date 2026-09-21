"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { AssetDialog } from "@/features/assets/components/asset-dialog";
import { ValuationDialog } from "@/features/assets/components/valuation-dialog";
import type { AssetDto } from "@/features/assets/types";

/** Re-price, edit, archive and restore, for a single asset. */
export function AssetActions({ asset }: { asset: AssetDto }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [priceOpen, setPriceOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function call(action: "archive" | "restore") {
    setPending(true);

    try {
      const response = await fetch(`/api/assets/${asset.id}/${action}`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(payload?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success(
        action === "archive" ? "دارایی بایگانی شد." : "دارایی بازگردانده شد.",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {/*
        Re-pricing is the primary action, not editing: it is what a household
        actually comes to this page to do (task 3.8).
      */}
      <Button
        disabled={!asset.isActive}
        onClick={() => {
          setPriceOpen(true);
        }}
      >
        <TrendingUp />
        ثبت قیمت روز
      </Button>

      <Button
        variant="secondary"
        disabled={!asset.isActive}
        onClick={() => {
          setEditOpen(true);
        }}
      >
        <Pencil />
        ویرایش
      </Button>

      {asset.isActive ? (
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

      <AssetDialog asset={asset} open={editOpen} onOpenChange={setEditOpen} />
      <ValuationDialog asset={asset} open={priceOpen} onOpenChange={setPriceOpen} />
    </div>
  );
}
