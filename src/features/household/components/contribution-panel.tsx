import { HandCoins, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import type { ContributionDto } from "@/features/household/types";

/**
 * What each person put into the household this month (task 7.7).
 *
 * Deliberately **not** a scoreboard. The roadmap says so outright, and it is
 * the right call: a household where one person earns more and the other does
 * more of the unpaid work is not behind on a table. So the order is fixed
 * rather than sorted by size, there is no share-of-total, no bar comparing
 * one against the other, and no winner.
 *
 * What it does say is where the money came from, because that is the part a
 * household actually needs when it sits down to talk: what went straight out
 * of someone's own account, and what they moved into the shared pot.
 */
export function ContributionPanel({
  contributions,
}: {
  contributions: ContributionDto[];
}) {
  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>سهم هر نفر</CardTitle>
          <CardDescription>
            آنچه این ماه از جیب هر نفر برای خانه هزینه شده است.
          </CardDescription>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <HandCoins className="size-5" />
        </span>
      </CardHeader>

      {/*
        A fixed grid rather than a list ordered by size: the order is the
        order people were added in, and stays that way whoever paid more.
      */}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {contributions.map((contribution) => (
          <li key={contribution.owner}>
            <div className="flex h-full flex-col gap-3 rounded-lg border border-border p-4">
              <span className="truncate text-body font-semibold">
                {contribution.name}
              </span>

              <Money rial={contribution.total} className="text-h3 font-light" />

              <dl className="mt-auto space-y-1 text-caption text-muted-foreground">
                <div className="flex items-baseline justify-between gap-3">
                  <dt>پرداخت مستقیم هزینه‌های مشترک</dt>
                  <dd>
                    <Money rial={contribution.direct} unit={false} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt>واریز به حساب مشترک</dt>
                  <dd>
                    <Money rial={contribution.pooled} unit={false} />
                  </dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ul>

      <Alert variant="info">
        <Info />
        <AlertTitle>این بخش فقط اطلاعاتی است</AlertTitle>
        <AlertDescription>
          هزینه‌ای که از حساب مشترک پرداخت شده، سهم کسی حساب نمی‌شود؛ آن پول از قبل
          مشترک بوده است. درآمد هم سهم نیست — آنچه شمرده می‌شود، پولی است که از جیب هر
          نفر برای خانه خرج شده.
        </AlertDescription>
      </Alert>
    </Card>
  );
}
