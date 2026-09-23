"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, PiggyBank, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedList } from "@/components/common/animated-list";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import { toast } from "@/components/ui/sonner";
import { BUDGET_STATE_LABELS } from "@/features/budgets/tracking";
import { BUDGET_STATE_STYLE } from "@/features/budgets/format";
import { BudgetAlerts } from "@/features/budgets/components/budget-alerts";
import { BudgetDialog } from "@/features/budgets/components/budget-dialog";
import { BudgetProgressBar } from "@/features/budgets/components/budget-progress";
import type { BudgetLineDto, BudgetMonthDto } from "@/features/budgets/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { OWNERS, OWNER_LABELS, type Owner } from "@/features/accounts/types";

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
 *
 * The owner tabs are a scope, not a filter (task 7.5). A budget belongs to
 * whoever it measures: the household's food budget counts household food,
 * and Reza's counts Reza's. Switching tabs is asking a different question,
 * not narrowing the answer to the same one — which is why the URL carries it
 * and the server re-reads, rather than the client hiding rows.
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

  /** Both the month and the scope live in the URL, so a view is linkable. */
  function go({ month = budget.month, owner = budget.owner } = {}) {
    const params = new URLSearchParams();
    if (month !== currentMonth) params.set("month", String(month));
    if (owner !== "SHARED") params.set("owner", owner);

    const query = params.toString();
    router.push(query ? `/budgets?${query}` : "/budgets");
  }

  async function remove(line: BudgetLineDto) {
    setPending(line.categoryId);

    try {
      const response = await fetch(
        `/api/budgets?categoryId=${encodeURIComponent(line.categoryId)}&owner=${line.owner}&fromMonth=${budget.month}`,
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
      <HeroCard
        label={
          budget.owner === "SHARED"
            ? `خرج مشترک در ${budget.label}`
            : `خرج شخصی ${OWNER_LABELS[budget.owner]} در ${budget.label}`
        }
        icon={PiggyBank}
        value={totals.spent}
        meta={
          <>
            <span>از</span>
            <Money rial={totals.available} className="text-caption" unit={false} />
            <span>تومان بودجه</span>
          </>
        }
        stats={[
          {
            label: totals.state === "OVER" ? "بیش از بودجه" : "باقی‌مانده این ماه",
            rial:
              totals.state === "OVER"
                ? (-BigInt(totals.remaining)).toString()
                : totals.remaining,
            alert: totals.state === "OVER",
          },
        ]}
      >
        <BudgetProgressBar
          spent={totals.spent}
          available={totals.available}
          ratio={totals.ratio}
          state={totals.state}
          showAmounts={false}
          className="mt-2 max-w-xl"
        />
      </HeroCard>

      <Toolbar>
        <Tabs
          value={budget.owner}
          onValueChange={(value) => {
            go({ owner: value as Owner });
          }}
        >
          <TabsList>
            {OWNERS.map((owner) => (
              <TabsTrigger key={owner} value={owner}>
                {owner === "SHARED" ? "خانواده" : OWNER_LABELS[owner]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1">
          {/* In RTL the earlier month is to the right, so the arrows swap. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="ماه قبل"
            onClick={() => {
              go({ month: budget.month - 1 });
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
              go({ month: budget.month + 1 });
            }}
          >
            <ChevronLeft />
          </Button>
        </div>
        {addButton}
      </Toolbar>

      <BudgetAlerts alerts={budget.alerts} />

      {budget.lines.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title={
            budget.owner === "SHARED"
              ? "برای این ماه بودجه‌ مشترکی تعیین نشده است"
              : `${OWNER_LABELS[budget.owner]} برای این ماه بودجه‌ای ندارد`
          }
          description={
            budget.owner === "SHARED"
              ? "برای هر دسته یک سقف ماهانه بگذارید تا خرج مشترک خانه در برابر آن سنجیده شود."
              : "بودجه شخصی فقط خرج همین نفر را می‌سنجد و روی بودجه مشترک اثری ندارد."
          }
          action={addButton}
        />
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budget.lines.map((line) => (
            <BudgetCard
              key={line.categoryId}
              line={line}
              pending={pending === line.categoryId}
              onEdit={() => {
                setEditing(line);
              }}
              onRemove={() => void remove(line)}
            />
          ))}
        </AnimatedList>
      )}

      <BudgetDialog
        month={budget.month}
        monthLabel={budget.label}
        owner={budget.owner}
        categories={categories}
        budgetedIds={budget.lines.map((line) => line.categoryId)}
        open={adding}
        onOpenChange={setAdding}
      />

      <BudgetDialog
        line={editing ?? undefined}
        month={budget.month}
        monthLabel={budget.label}
        owner={budget.owner}
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
    <Card className="h-full gap-4">
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
