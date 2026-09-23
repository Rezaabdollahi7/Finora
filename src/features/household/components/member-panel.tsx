import Link from "next/link";
import { PiggyBank, Target, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import type { MemberViewDto } from "@/features/household/types";

function Figure({
  label,
  rial,
  tone,
}: {
  label: string;
  rial: string;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className={cn("text-body font-medium", tone === "danger" && "text-danger")}>
        <Money rial={rial} />
      </dd>
    </div>
  );
}

/**
 * One person's own picture (task 7.8).
 *
 * Their income, their spending, what they put into the household, their own
 * accounts, their personal budget and their goals — the five things the
 * roadmap lists, in one panel each.
 *
 * The budget and the goals link out rather than duplicating those screens.
 * A second place to edit a budget is a second place for it to go wrong, and
 * the numbers here are a summary, not a control panel (rule G.7).
 */
export function MemberPanel({ member }: { member: MemberViewDto }) {
  // What they kept, not income minus personal spending: their share of the
  // household's costs left their pocket too.
  const overspent = BigInt(member.retained) < 0n;

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>{member.name}</CardTitle>
          <CardDescription>درآمد، خرج و سهم شخصی در این ماه</CardDescription>
        </div>
      </CardHeader>

      <dl>
        <Figure label="درآمد این ماه" rial={member.totals.income} />
        <Figure label="خرج شخصی این ماه" rial={member.totals.expenses} />
        <Figure label="سهم در هزینه‌های خانه" rial={member.contribution.total} />
        <Figure
          label={overspent ? "کسری این ماه" : "باقی‌مانده این ماه"}
          rial={overspent ? (-BigInt(member.retained)).toString() : member.retained}
          tone={overspent ? "danger" : undefined}
        />
        <Figure label="موجودی حساب‌های شخصی" rial={member.accountBalance} />
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="flex items-center gap-2 text-caption text-muted-foreground">
            <PiggyBank className="size-4" />
            بودجه شخصی
          </span>
          {member.budget ? (
            <>
              {/*
                Each part is its own element: a neutral separator between
                Persian text and a number is reordered by the bidi algorithm.
              */}
              <span className="flex flex-wrap items-baseline gap-1.5 text-body font-medium">
                <Money rial={member.budget.spent} unit={false} />
                <span className="text-muted-foreground">از</span>
                <Money
                  rial={member.budget.amount}
                  unit={false}
                  className="text-muted-foreground"
                />
              </span>
              <span className="text-caption text-muted-foreground">
                {member.budget.count.toLocaleString("fa-IR")} دسته
              </span>
            </>
          ) : (
            <span className="text-body text-muted-foreground">بودجه شخصی ندارد</span>
          )}
          <Button variant="ghost" size="sm" className="mt-auto self-start" asChild>
            <Link href={`/budgets?owner=${member.owner}`}>بودجه‌های شخصی</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <span className="flex items-center gap-2 text-caption text-muted-foreground">
            <Target className="size-4" />
            اهداف
          </span>
          {member.goals.count > 0 ? (
            <>
              <span className="flex flex-wrap items-baseline gap-1.5 text-body font-medium">
                <Money rial={member.goals.currentAmount} unit={false} />
                <span className="text-muted-foreground">از</span>
                <Money
                  rial={member.goals.targetAmount}
                  unit={false}
                  className="text-muted-foreground"
                />
              </span>
              <span className="text-caption text-muted-foreground">
                {member.goals.count.toLocaleString("fa-IR")} هدف در جریان
              </span>
            </>
          ) : (
            <span className="text-body text-muted-foreground">هدفی در جریان نیست</span>
          )}
          <Button variant="ghost" size="sm" className="mt-auto self-start" asChild>
            <Link href="/goals">همه اهداف</Link>
          </Button>
        </div>
      </div>

      <Button variant="secondary" size="sm" className="self-start" asChild>
        <Link href={`/transactions?owner=${member.owner}`}>
          <Wallet />
          تراکنش‌های {member.name}
        </Link>
      </Button>
    </Card>
  );
}
