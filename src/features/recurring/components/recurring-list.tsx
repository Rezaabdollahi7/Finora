"use client";

import * as React from "react";
import { Plus, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedList } from "@/components/common/animated-list";
import { Toolbar } from "@/components/common/toolbar";
import { EmptyState } from "@/components/common/empty-state";
import { HeroCard } from "@/components/common/hero-card";
import { type AccountDto, type Owner } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { RecurringCard } from "@/features/recurring/components/recurring-card";
import { RecurringDialog } from "@/features/recurring/components/recurring-dialog";
import { summariseRecurring } from "@/features/recurring/summary";
import type { OccurrenceDto, RecurringPaymentDto } from "@/features/recurring/types";
import { useOwners } from "@/features/members/components/members-provider";

/**
 * The recurring payments screen (task 5.5).
 *
 * The headline is what the next thirty days will cost, not what one rule is
 * worth. A household with rent, two utilities and three subscriptions does
 * not care about any of them individually; it cares whether the month is
 * affordable.
 *
 * That figure is a sum of real occurrences rather than an arithmetic guess
 * at a "monthly equivalent": a weekly rule falls four or five times in
 * thirty days, and a yearly one usually falls not at all. Dividing and
 * multiplying to get a smooth monthly number would produce a figure no month
 * ever actually costs.
 *
 * Filtering happens on the client because the whole set is already here and a
 * household has a handful of rules — a round trip per tab would flash.
 */
export function RecurringList({
  payments,
  occurrences,
  accounts,
  categories,
  nowIso,
}: {
  payments: RecurringPaymentDto[];
  /** Occurrences from a little before today to thirty days after it. */
  occurrences: OccurrenceDto[];
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  /** The server's "now", so the client renders the same statuses it did. */
  nowIso: string;
}) {
  const owners = useOwners();
  const [owner, setOwner] = React.useState<Owner | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const now = React.useMemo(() => new Date(nowIso), [nowIso]);

  const visible = React.useMemo(
    () =>
      owner === "ALL"
        ? payments
        : payments.filter((payment) => payment.owner === owner),
    [payments, owner],
  );

  const totals = React.useMemo(
    () => summariseRecurring(payments, occurrences, owner),
    [payments, occurrences, owner],
  );

  const addButton = (
    <Button
      onClick={() => {
        setDialogOpen(true);
      }}
    >
      <Plus />
      ثبت پرداخت دوره‌ای
    </Button>
  );

  return (
    <div className="space-y-6">
      <HeroCard
        label={
          owner === "ALL"
            ? "پرداخت‌های ۳۰ روز آینده"
            : `پرداخت‌های ۳۰ روز آینده ${owners.label(owner)}`
        }
        icon={Repeat}
        value={totals.upcoming}
        meta={<span>{totals.activeCount.toLocaleString("fa-IR")} پرداخت فعال</span>}
        stats={
          totals.overdueCount > 0
            ? [
                {
                  label: "پرداخت معوق",
                  content: totals.overdueCount.toLocaleString("fa-IR"),
                  alert: true,
                },
                { label: "مبلغ معوق", rial: totals.overdueAmount, alert: true },
              ]
            : undefined
        }
      />

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
          icon={Repeat}
          title={
            payments.length === 0
              ? "پرداخت دوره‌ای ثبت نشده است"
              : "پرداختی برای این مالک نیست"
          }
          description={
            payments.length === 0
              ? "اجاره، قبض و اشتراک‌ها را یک‌بار ثبت کنید تا سررسیدهای آینده‌شان خودکار ساخته شود و در تقویم دیده شوند."
              : "با انتخاب «همه» بقیه پرداخت‌ها را ببینید، یا برای این مالک پرداختی ثبت کنید."
          }
          action={addButton}
        />
      ) : (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((payment) => (
            <RecurringCard key={payment.id} payment={payment} now={now} />
          ))}
        </AnimatedList>
      )}

      <RecurringDialog
        accounts={accounts}
        categories={categories}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
