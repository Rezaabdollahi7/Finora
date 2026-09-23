"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Gem, Landmark, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import { OWNER_LABELS } from "@/features/accounts/types";
import { ContributionPanel } from "@/features/household/components/contribution-panel";
import { MemberPanel } from "@/features/household/components/member-panel";
import type { HouseholdMember, HouseholdMonthDto } from "@/features/household/types";

/**
 * The household screen (tasks 7.6–7.8).
 *
 * One month at a time, like the budgets screen, because "what did the
 * household earn and spend" only means anything against a month.
 *
 * The tabs switch between the household's own picture and each person's.
 * They are a scope, not a filter: the household tab shows what the two
 * people share, and a person's tab shows what is theirs. Neither is a subset
 * of the other, which is the whole point of the sprint.
 */
export function HouseholdView({
  household,
  currentMonth,
}: {
  household: HouseholdMonthDto;
  /**
   * The month the server considers "now". Passed rather than read from the
   * browser's clock, so a phone with the wrong date cannot disagree with the
   * figures rendered beside it.
   */
  currentMonth: number;
}) {
  const router = useRouter();
  const [scope, setScope] = React.useState<"HOUSEHOLD" | HouseholdMember>("HOUSEHOLD");

  function goToMonth(month: number) {
    router.push(month === currentMonth ? "/household" : `/household?month=${month}`);
  }

  const member =
    scope === "HOUSEHOLD"
      ? null
      : household.members.find((entry) => entry.owner === scope)!;

  const totals = member ? member.totals : household.household;

  // For a person this is what they kept, not income minus personal spending:
  // a shared cost paid from their own account left their pocket too.
  const headline = member ? member.retained : totals.savings;
  const overspent = BigInt(headline) < 0n;

  // A month with nothing in it at all. Zeroes across five cards say "the
  // arithmetic ran" where a household needs to be told "there is nothing
  // here yet, and here is where to start" (task 8.12).
  const nothingYet =
    household.household.income === "0" &&
    household.household.expenses === "0" &&
    household.sharedAssets === "0" &&
    household.sharedLiabilities === "0";

  return (
    <div className="space-y-6">
      <HeroCard
        label={
          member
            ? `باقی‌مانده برای ${OWNER_LABELS[member.owner]} در ${household.label}`
            : `پس‌انداز خانه در ${household.label}`
        }
        icon={Users}
        value={overspent ? (-BigInt(headline)).toString() : headline}
        negative={overspent}
        meta={
          <span>
            {overspent
              ? "بیش از درآمد خرج شده"
              : member
                ? "درآمد منهای خرج شخصی و سهم خانه"
                : "درآمد منهای خرج"}
          </span>
        }
        stats={[
          { label: "درآمد", rial: totals.income },
          { label: member ? "خرج شخصی" : "خرج", rial: totals.expenses },
          ...(member ? [{ label: "سهم خانه", rial: member.contribution.total }] : []),
        ]}
      />

      <Toolbar>
        <Tabs
          value={scope}
          onValueChange={(value) => {
            setScope(value as "HOUSEHOLD" | HouseholdMember);
          }}
        >
          <TabsList>
            <TabsTrigger value="HOUSEHOLD">خانه</TabsTrigger>
            {household.members.map((member) => (
              <TabsTrigger key={member.owner} value={member.owner}>
                {OWNER_LABELS[member.owner]}
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
              goToMonth(household.month - 1);
            }}
          >
            <ChevronRight />
          </Button>
          <span className="min-w-32 text-center text-body font-medium">
            {household.label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="ماه بعد"
            onClick={() => {
              goToMonth(household.month + 1);
            }}
          >
            <ChevronLeft />
          </Button>
        </div>
      </Toolbar>

      {nothingYet ? (
        <EmptyState
          icon={Users}
          title={`در ${household.label} چیزی ثبت نشده است`}
          description="با ثبت درآمد و هزینه در صفحه تراکنش‌ها، تصویر خانه و سهم هر نفر همین‌جا ساخته می‌شود."
          action={
            <Button asChild>
              <Link href="/transactions">ثبت تراکنش</Link>
            </Button>
          }
        />
      ) : scope === "HOUSEHOLD" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SharedFigure
              icon={Gem}
              label="دارایی‌های مشترک"
              rial={household.sharedAssets}
              description="آنچه خانه مشترکاً در اختیار دارد"
            />
            <SharedFigure
              icon={Landmark}
              label="بدهی‌های مشترک"
              rial={household.sharedLiabilities}
              description="مانده وام‌هایی که به نام خانه است"
              tone="danger"
            />
          </div>

          <Card variant="featured" className="gap-4">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <Split label="خرج مشترک خانه" rial={household.shared.expenses} />
              {household.members.map((member) => (
                <Split
                  key={member.owner}
                  label={`خرج شخصی ${OWNER_LABELS[member.owner]}`}
                  rial={member.totals.expenses}
                />
              ))}
            </div>
          </Card>

          <ContributionPanel contributions={household.contributions} />
        </>
      ) : (
        <MemberPanel member={member!} />
      )}
    </div>
  );
}

function SharedFigure({
  icon: Icon,
  label,
  rial,
  description,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  rial: string;
  description: string;
  tone?: "danger";
}) {
  return (
    <Card variant="compact" className="gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md",
            tone === "danger"
              ? "bg-danger-subtle text-danger"
              : "bg-primary-soft text-primary",
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold">{label}</span>
          <span className="truncate text-caption text-muted-foreground">
            {description}
          </span>
        </span>
      </div>
      <Money rial={rial} className="text-h3 font-light" />
    </Card>
  );
}

function Split({ label, rial }: { label: string; rial: string }) {
  return (
    <div className="space-y-1">
      <span className="text-caption text-muted-foreground">{label}</span>
      <Money rial={rial} className="block text-h3 font-light" />
    </div>
  );
}
