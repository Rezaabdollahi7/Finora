"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ContributionDialog } from "@/features/goals/components/contribution-dialog";
import { GoalDialog } from "@/features/goals/components/goal-dialog";
import type { GoalDto } from "@/features/goals/types";

/** Everything that can be done to one goal (tasks 6.2 and 6.4). */
export function GoalActions({ goal }: { goal: GoalDto }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [withdrawing, setWithdrawing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const archived = goal.status === "ARCHIVED";
  const completed = goal.status === "COMPLETED";

  async function call(path: string, method: "POST" | "DELETE", message: string) {
    setPending(true);

    try {
      const response = await fetch(`/api/goals/${goal.id}${path}`, { method });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success(message);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {!archived ? (
        <>
          <Button
            onClick={() => {
              setAdding(true);
            }}
          >
            <Plus />
            افزودن مبلغ
          </Button>
          <Button
            variant="secondary"
            disabled={BigInt(goal.progress.currentAmount) === 0n}
            onClick={() => {
              setWithdrawing(true);
            }}
          >
            <Minus />
            برداشت
          </Button>
        </>
      ) : null}

      <Button
        variant="secondary"
        disabled={archived}
        onClick={() => {
          setEditing(true);
        }}
      >
        <Pencil />
        ویرایش
      </Button>

      {!archived ? (
        completed ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              void call("/complete", "DELETE", "هدف دوباره باز شد.");
            }}
          >
            <RotateCcw />
            بازگشایی
          </Button>
        ) : (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              void call("/complete", "POST", "هدف تکمیل شد.");
            }}
          >
            <CheckCircle2 />
            تکمیل شد
          </Button>
        )
      ) : null}

      {archived ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            void call("/restore", "POST", "هدف بازگردانده شد.");
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
            void call("/archive", "POST", "هدف بایگانی شد.");
          }}
        >
          <Archive />
          بایگانی
        </Button>
      )}

      <GoalDialog goal={goal} open={editing} onOpenChange={setEditing} />
      <ContributionDialog goal={goal} open={adding} onOpenChange={setAdding} />
      <ContributionDialog
        goal={goal}
        withdrawal
        open={withdrawing}
        onOpenChange={setWithdrawing}
      />
    </div>
  );
}
