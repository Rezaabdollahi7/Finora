"use client";

import * as React from "react";
import { Plus, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedList } from "@/components/common/animated-list";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { sumRial } from "@/utils/money";
import { type Owner } from "@/features/accounts/types";
import { GoalCard } from "@/features/goals/components/goal-card";
import { GoalDialog } from "@/features/goals/components/goal-dialog";
import type { GoalDto } from "@/features/goals/types";
import { useOwners } from "@/features/members/components/members-provider";

/**
 * The goals screen (task 6.5).
 *
 * The headline is what the household has to put aside each month across
 * every goal it has a date for. A progress bar per goal says where things
 * stand; only that one figure says whether the plan is affordable at all.
 *
 * Goals with no deadline are left out of it, and said so, because there is
 * no month to spread them over and folding them in would invent a number.
 *
 * Filtering happens on the client because the whole set is already here and
 * a household has a handful of goals — a round trip per tab would flash.
 */
export function GoalList({ goals }: { goals: GoalDto[] }) {
  const owners = useOwners();
  const [owner, setOwner] = React.useState<Owner | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const visible = React.useMemo(
    () => (owner === "ALL" ? goals : goals.filter((goal) => goal.owner === owner)),
    [goals, owner],
  );

  const totals = React.useMemo(() => {
    const live = visible.filter(
      (goal) => goal.status === "ACTIVE" && !goal.progress.isReached,
    );

    const dated = live.filter((goal) => goal.progress.monthlyContribution !== null);

    return {
      monthly: sumRial(
        dated.map((goal) => BigInt(goal.progress.monthlyContribution!)),
      ).toString(),
      remaining: sumRial(
        live.map((goal) => BigInt(goal.progress.remainingAmount)),
      ).toString(),
      activeCount: live.length,
      undatedCount: live.length - dated.length,
    };
  }, [visible]);

  const addButton = (
    <Button
      onClick={() => {
        setDialogOpen(true);
      }}
    >
      <Plus />
      ثبت هدف
    </Button>
  );

  return (
    <div className="space-y-6">
      <HeroCard
        label={
          owner === "ALL"
            ? "پس‌انداز ماهانه لازم"
            : `پس‌انداز ماهانه ${owners.label(owner)}`
        }
        icon={Target}
        value={totals.monthly}
        meta={<span>{totals.activeCount.toLocaleString("fa-IR")} هدف در جریان</span>}
        stats={[{ label: "باقی‌مانده تا همه اهداف", rial: totals.remaining }]}
      >
        {totals.undatedCount > 0 ? (
          <span className="flex flex-wrap items-center gap-2 text-caption text-on-brand/70">
            <span className="tabular">
              {totals.undatedCount.toLocaleString("fa-IR")}
            </span>
            <span>هدف بدون مهلت، در رقم ماهانه شمرده نشده است</span>
          </span>
        ) : null}
      </HeroCard>

      <Toolbar>
        {owners.enabled ? (
          <Tabs
            value={owner}
            onValueChange={(value) => {
              setOwner(value as Owner | "ALL");
            }}
          >
            <TabsList>
              <TabsTrigger value="ALL">همه</TabsTrigger>
              {owners.options.map(({ value: value }) => (
                <TabsTrigger key={value} value={value}>
                  {owners.label(value)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <span aria-hidden />
        )}
        {addButton}
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState
          icon={Target}
          title={goals.length === 0 ? "هدفی ثبت نشده است" : "هدفی برای این مالک نیست"}
          description={
            goals.length === 0
              ? "یک مبلغ و یک تاریخ مشخص کنید تا ببینید هر ماه چقدر باید کنار بگذارید."
              : "با انتخاب «همه» بقیه اهداف را ببینید، یا برای این مالک هدفی ثبت کنید."
          }
          action={addButton}
        />
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </AnimatedList>
      )}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
