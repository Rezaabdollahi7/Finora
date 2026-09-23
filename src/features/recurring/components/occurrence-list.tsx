"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { toast } from "@/components/ui/sonner";
import { formatJalaliDate, formatRelativeDay } from "@/utils/date";
import { OCCURRENCE_STATUS_LABELS } from "@/features/recurring/recurrence";
import { OCCURRENCE_STATUS_STYLE } from "@/features/recurring/format";
import type { AccountDto } from "@/features/accounts/types";
import { PayOccurrenceDialog } from "@/features/recurring/components/pay-occurrence-dialog";
import type {
  OccurrenceDto,
  RecurringPaymentDetailDto,
} from "@/features/recurring/types";

/**
 * The occurrences around today, with the one action that matters on them.
 *
 * Unlike a loan's instalments these are not rows until they are paid: the
 * rule is open-ended, so the future here is a projection. What that changes
 * for the reader is nothing — an expected payment looks and behaves like an
 * unpaid instalment — and that is deliberate.
 *
 * Undo sits on paid rows rather than hidden in a menu. It is the only way
 * back from a mis-click, since the expense it created cannot be deleted from
 * the transactions page on its own.
 *
 * Only what is still owed is shown by default. A weekly rule produces some
 * seventy occurrences in the window the server sends, and rendering all of
 * them buries the two that are overdue. The paid ones are history; they are
 * one tap away.
 */

/**
 * How many upcoming occurrences to show before folding the rest away.
 *
 * Half a year of monthly payments: far enough ahead to plan around, short
 * enough to read on a phone. Every overdue occurrence is shown whatever this
 * says — they sort first, and a payment that is late is never the thing to
 * hide.
 */
const WINDOW = 6;

export function OccurrenceList({
  payment,
  accounts,
  now,
}: {
  payment: RecurringPaymentDetailDto;
  accounts: AccountDto[];
  now: Date;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [paying, setPaying] = React.useState<OccurrenceDto | null>(null);

  const unpaid = payment.occurrences.filter((entry) => entry.status !== "PAID");
  const paidCount = payment.occurrences.length - unpaid.length;
  const nextUnpaid = unpaid[0];

  const visible = showAll
    ? payment.occurrences
    : unpaid.length > 0
      ? unpaid.slice(0, WINDOW)
      : // An ended rule owes nothing; its tail is the interesting part.
        payment.occurrences.slice(-WINDOW);

  const hidden = payment.occurrences.length - visible.length;

  /**
   * Undo goes straight through; paying opens a dialog, because the amount,
   * the date and the account are decisions rather than defaults.
   */
  async function undo(dueDate: string) {
    setPending(dueDate);

    try {
      const response = await fetch(
        `/api/recurring/${payment.id}/pay?dueDate=${encodeURIComponent(dueDate)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success("پرداخت لغو شد.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>سررسیدها</CardTitle>
          <CardDescription>
            ثبت هر پرداخت یک هزینه در حساب انتخاب‌شده ایجاد می‌کند.
          </CardDescription>
        </div>
        <div className="shrink-0 text-end text-caption text-muted-foreground">
          <span className="tabular">{paidCount.toLocaleString("fa-IR")}</span> پرداخت
          ثبت‌شده
        </div>
      </CardHeader>

      {payment.occurrences.length === 0 ? (
        <p className="py-6 text-center text-body text-muted-foreground">
          در بازه نمایش، سررسیدی برای این پرداخت نیست.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((occurrence) => (
            <OccurrenceRow
              key={occurrence.dueDate}
              occurrence={occurrence}
              now={now}
              emphasised={occurrence.dueDate === nextUnpaid?.dueDate}
              payDisabled={!payment.isActive}
              pending={pending === occurrence.dueDate}
              onPay={() => {
                setPaying(occurrence);
              }}
              onUndo={() => void undo(occurrence.dueDate)}
            />
          ))}
        </ul>
      )}

      {hidden > 0 || showAll ? (
        <Button
          variant="ghost"
          onClick={() => {
            setShowAll((value) => !value);
          }}
        >
          {showAll ? <ChevronUp /> : <ChevronDown />}
          {showAll
            ? "نمایش فقط سررسیدهای پیش‌رو"
            : `نمایش تاریخچه و همه ${payment.occurrences.length.toLocaleString("fa-IR")} سررسید`}
        </Button>
      ) : null}

      <PayOccurrenceDialog
        payment={payment}
        occurrence={paying}
        accounts={accounts}
        open={paying !== null}
        onOpenChange={(next) => {
          if (!next) setPaying(null);
        }}
      />
    </Card>
  );
}

function OccurrenceRow({
  occurrence,
  now,
  emphasised,
  payDisabled,
  pending,
  onPay,
  onUndo,
}: {
  occurrence: OccurrenceDto;
  now: Date;
  emphasised: boolean;
  /**
   * An inactive rule produces nothing new to pay. Undo stays available on
   * what it already paid: switching a rule off must not strand a mis-click.
   */
  payDisabled: boolean;
  pending: boolean;
  onPay: () => void;
  onUndo: () => void;
}) {
  const style = OCCURRENCE_STATUS_STYLE[occurrence.status];
  const Icon = style.icon;
  const paid = occurrence.status === "PAID";

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 py-3",
        emphasised && "-mx-3 rounded-md bg-primary-soft px-3",
      )}
    >
      {/*
        A fixed column, so the status badges line up down the page instead of
        stepping in and out with the length of each month's name — "اردیبهشت"
        is four characters longer than "دی".
      */}
      <span className="flex w-36 min-w-0 shrink-0 flex-col">
        <span className="text-body">
          {formatJalaliDate(new Date(occurrence.dueDate))}
        </span>
        <span className="text-caption text-muted-foreground">
          {paid && occurrence.paidAt
            ? `پرداخت در ${formatJalaliDate(new Date(occurrence.paidAt), { style: "medium" })}`
            : formatRelativeDay(new Date(occurrence.dueDate), { now })}
        </span>
      </span>

      <Badge variant={style.tone} className="shrink-0">
        <Icon />
        {OCCURRENCE_STATUS_LABELS[occurrence.status]}
      </Badge>

      <Money rial={occurrence.amount} className="ms-auto font-medium" unit={false} />

      {paid ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onUndo}>
          <Undo2 />
          لغو
        </Button>
      ) : (
        <Button
          variant={emphasised ? "primary" : "secondary"}
          size="sm"
          disabled={pending || payDisabled}
          onClick={onPay}
        >
          <Check />
          پرداخت
        </Button>
      )}
    </li>
  );
}
