"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PiggyBank, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { toast } from "@/components/ui/sonner";
import { BUDGET_STATE_LABELS } from "@/features/budgets/tracking";
import { BUDGET_STATE_STYLE } from "@/features/budgets/format";
import { BudgetAlerts } from "@/features/budgets/components/budget-alerts";
import { BudgetDialog } from "@/features/budgets/components/budget-dialog";
import { BudgetProgressBar } from "@/features/budgets/components/budget-progress";
import type { BudgetLineDto, BudgetMonthDto } from "@/features/budgets/types";
import type { CategoryTreeNode } from "@/features/categories/types";

/**
 * The budgets screen (task 5.8).
 *
 * One month at a time, because a budget is a monthly promise and the only
 * honest way to read it is against the month it was made for. The arrows
 * move between months; each one shows the budget that was actually in force
 * then, not today's applied backwards (rule G.4).
 *
 * The headline is the whole month rather than any one category: a household
 * that is over on food and under on transport has not overspent, and three
 * separate bars would not say so.
 */
export function BudgetList({
  budget,
  currentMonth,
  categories,
}: {
  budget: BudgetMonthDto;
  /**
   * The month the server considers "now". Passed rather than read from the
   * browser's clock, so a phone with the wrong date cannot disagree with the
   * figures rendered beside it.
   */
  currentMonth: number;
  categories: CategoryTreeNode[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<BudgetLineDto | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);

  const totals = budget.totals;

  function goToMonth(month: number) {
    router.push(month === currentMonth ? "/budgets" : `/budgets?month=${month}`);
  }

  async function remove(line: BudgetLineDto) {
    setPending(line.categoryId);

    try {
      const response = await fetch(
        `/api/budgets?categoryId=${encodeURIComponent(line.categoryId)}&fromMonth=${budget.month}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "حذف بودجه انجام نشد.");
        return;
      }

      toast.success("بودجه از این ماه به بعد برداشته شد.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const addButton = (
    <Button
      onClick={() => {
        setAdding(true);
      }}
    >
      <Plus />
      تعیین بودجه
    </Button>
  );

  return (
    <div className="space-y-6">
      <Card variant="ink" padding="large" className="gap-2">
        <span className="text-body text-ink-surface-muted">
          خرج‌شده در {budget.label}
        </span>
        {/*
          The figure steps down on a phone; at the display size a
          thirteen-digit total spills out of a 390px card.
        */}
        <Money rial={totals.spent} className="text-h1 sm:text-display" unit={false} />
        {/*
          Each part is its own element: a neutral separator between Persian
          text and a number is reordered by the bidi algorithm.
        */}
        <span className="flex flex-wrap items-center gap-2 text-caption text-ink-surface-subtle">
          <span>تومان</span>
          <span aria-hidden>·</span>
          <span>از</span>
          <Money rial={totals.available} className="text-caption" unit={false} />
          <span>تومان بودجه</span>
        </span>
        <BudgetProgressBar
          spent={totals.spent}
          available={totals.available}
          ratio={totals.ratio}
          state={totals.state}
          showAmounts={false}
          className="mt-4"
        />
        <span
          className={cn(
            "mt-1 flex flex-wrap items-baseline gap-2 text-caption",
            totals.state === "OVER" ? "text-danger" : "text-ink-surface-muted",
          )}
        >
          <span>{totals.state === "OVER" ? "بیش از بودجه" : "باقی‌مانده این ماه"}</span>
          <Money
            rial={
              totals.state === "OVER"
                ? (-BigInt(totals.remaining)).toString()
                : totals.remaining
            }
            className="font-medium"
          />
        </span>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {/* In RTL the earlier month is to the right, so the arrows swap. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="ماه قبل"
            onClick={() => {
              goToMonth(budget.month - 1);
            }}
          >
            <ChevronRight />
          </Button>
          <span className="min-w-32 text-center text-body font-medium">
            {budget.label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ماه بعد"
            onClick={() => {
              goToMonth(budget.month + 1);
            }}
          >
            <ChevronLeft />
          </Button>
        </div>
        {addButton}
      </div>

      <BudgetAlerts alerts={budget.alerts} />

      {budget.lines.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="برای این ماه بودجه‌ای تعیین نشده است"
          description="برای هر دسته یک سقف ماهانه بگذارید تا خرج هر ماه در برابر آن سنجیده شود."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budget.lines.map((line) => (
            <li key={line.categoryId} className="contents">
              <BudgetCard
                line={line}
                pending={pending === line.categoryId}
                onEdit={() => {
                  setEditing(line);
                }}
                onRemove={() => void remove(line)}
              />
            </li>
          ))}
        </ul>
      )}

      <BudgetDialog
        month={budget.month}
        monthLabel={budget.label}
        categories={categories}
        budgetedIds={budget.lines.map((line) => line.categoryId)}
        open={adding}
        onOpenChange={setAdding}
      />

      <BudgetDialog
        line={editing ?? undefined}
        month={budget.month}
        monthLabel={budget.label}
        categories={categories}
        budgetedIds={budget.lines.map((line) => line.categoryId)}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

function BudgetCard({
  line,
  pending,
  onEdit,
  onRemove,
}: {
  line: BudgetLineDto;
  pending: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const style = BUDGET_STATE_STYLE[line.state];
  const Icon = style.icon;
  const over = line.state === "OVER";

  return (
    <Card variant="compact" className="gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold">{line.categoryName}</span>
          {line.parentName ? (
            <span className="truncate text-caption text-muted-foreground">
              {line.parentName}
            </span>
          ) : null}
        </span>
        <Badge variant={style.badge} className="shrink-0">
          <Icon />
          {BUDGET_STATE_LABELS[line.state]}
        </Badge>
      </div>

      <BudgetProgressBar
        spent={line.spent}
        available={line.available}
        ratio={line.ratio}
        state={line.state}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption">
        <span className={cn("flex items-baseline gap-2", over && "text-danger")}>
          <span className={cn(!over && "text-muted-foreground")}>
            {over ? "بیش از بودجه" : "باقی‌مانده"}
          </span>
          <Money
            rial={over ? (-BigInt(line.remaining)).toString() : line.remaining}
            unit={false}
            className="font-medium"
          />
        </span>
        {BigInt(line.carriedIn) > 0n ? (
          <span className="flex items-baseline gap-2">
            <span className="text-muted-foreground">انتقالی از ماه قبل</span>
            <Money rial={line.carriedIn} unit={false} className="font-medium" />
          </span>
        ) : null}
      </div>

      {/*
        Removing asks first. It is one tap from "ویرایش", and it does more
        than it looks: clearing from this month also drops any budget already
        set for a later one, which nothing on this card would show.
      */}
      {confirming ? (
        <div className="mt-auto space-y-3">
          <p className="text-caption text-muted-foreground">
            بودجه این دسته از این ماه به بعد برداشته شود؟
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={onRemove}
            >
              {pending ? "در حال حذف…" : "بله، بردار"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfirming(false);
              }}
            >
              انصراف
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            ویرایش
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Trash2 />
            برداشتن
          </Button>
          {line.rollover ? (
            <Badge variant="outline" className="ms-auto">
              انتقال مانده
            </Badge>
          ) : null}
        </div>
      )}
    </Card>
  );
}
