"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Undo2 } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/common/money";
import { toast } from "@/components/ui/sonner";
import { formatJalaliDate } from "@/utils/date";
import type { GoalContributionDto, GoalDetailDto } from "@/features/goals/types";

/**
 * Everything put in and taken back out (task 6.4).
 *
 * A withdrawal is its own row rather than a contribution that shrank, so the
 * history reads as what actually happened. Removing one is for a mis-typed
 * entry; taking money back out is a withdrawal, and the two are different
 * things.
 */
export function ContributionList({ goal }: { goal: GoalDetailDto }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function remove(contribution: GoalContributionDto) {
    setPending(contribution.id);

    try {
      const response = await fetch(
        `/api/goals/${goal.id}/contributions/${contribution.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success("رکورد حذف شد.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>تاریخچه</CardTitle>
          <CardDescription>
            این مبالغ تراکنش نیستند و در درآمد و هزینه شمرده نمی‌شوند.
          </CardDescription>
        </div>
        <div className="shrink-0 text-end text-caption text-muted-foreground">
          <span className="tabular">
            {goal.contributions.length.toLocaleString("fa-IR")}
          </span>{" "}
          رکورد
        </div>
      </CardHeader>

      {goal.contributions.length === 0 ? (
        <p className="py-6 text-center text-body text-muted-foreground">
          هنوز مبلغی برای این هدف کنار گذاشته نشده است.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {goal.contributions.map((contribution) => (
            <li
              key={contribution.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
            >
              <span
                className={
                  contribution.isWithdrawal
                    ? "flex size-8 shrink-0 items-center justify-center rounded-md bg-danger-subtle text-danger"
                    : "flex size-8 shrink-0 items-center justify-center rounded-md bg-success-subtle text-success"
                }
              >
                {contribution.isWithdrawal ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>

              <span className="flex min-w-0 flex-col">
                <span className="text-body">
                  {formatJalaliDate(new Date(contribution.date))}
                </span>
                <span className="truncate text-caption text-muted-foreground">
                  {contribution.note ??
                    (contribution.isWithdrawal ? "برداشت" : "کنار گذاشته شد")}
                </span>
              </span>

              <Money
                rial={contribution.amount}
                className={
                  contribution.isWithdrawal
                    ? "ms-auto font-medium text-danger"
                    : "ms-auto font-medium"
                }
                unit={false}
              />

              <Button
                variant="ghost"
                size="sm"
                disabled={pending === contribution.id}
                onClick={() => void remove(contribution)}
              >
                <Undo2 />
                حذف
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
