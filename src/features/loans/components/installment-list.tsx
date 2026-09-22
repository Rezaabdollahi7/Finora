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
import { INSTALLMENT_STATUS_LABELS } from "@/features/loans/schedule";
import { INSTALLMENT_STATUS_STYLE } from "@/features/loans/format";
import type { InstallmentDto, LoanDetailDto } from "@/features/loans/types";

/**
 * The repayment schedule, with the one action that matters on it (task 4.4).
 *
 * The next unpaid instalment is the only one carrying a "pay" button by
 * default. Paying out of order is legitimate — a household can settle a late
 * one after a current one — so every unpaid row keeps the action, but only
 * the soonest one gets the emphasis, because that is the one being asked
 * for.
 *
 * Undo sits on paid rows rather than hidden in a menu. It is the only way
 * back from a mis-click, since the expense it created cannot be deleted from
 * the transactions page on its own.
 *
 * Only the instalments still owed are shown by default. A Tehran housing
 * loan runs to 120 of them — the roadmap's own example — and rendering every
 * one turns this page into several metres of scrolling in which the two that
 * are overdue are invisible. The paid ones are history; they are one tap
 * away and the count is always on screen.
 */

/**
 * How many unpaid instalments to show before folding the rest away.
 *
 * A year of monthly payments: far enough ahead to plan around, short enough
 * to read on a phone. Every overdue instalment is shown whatever this says —
 * they sit first in schedule order, and a debt that is late is never the
 * thing to hide.
 */
const WINDOW = 12;
export function InstallmentList({ loan, now }: { loan: LoanDetailDto; now: Date }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<number | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const unpaid = loan.installments.filter((entry) => entry.status !== "PAID");
  const paidCount = loan.installments.length - unpaid.length;
  const nextUnpaid = unpaid[0];

  const visible = showAll
    ? loan.installments
    : unpaid.length > 0
      ? unpaid.slice(0, Math.max(WINDOW, loan.progress.overdue))
      : // A settled loan has nothing owed; its tail is the interesting part.
        loan.installments.slice(-WINDOW);

  const hidden = loan.installments.length - visible.length;

  async function act(number: number, method: "POST" | "DELETE") {
    setPending(number);

    try {
      const response = await fetch(`/api/loans/${loan.id}/installments/${number}/pay`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(payload?.error?.message ?? "عملیات انجام نشد.");
        return;
      }

      toast.success(method === "POST" ? "قسط پرداخت شد." : "پرداخت قسط لغو شد.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card variant="featured" className="gap-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>جدول اقساط</CardTitle>
          <CardDescription>
            پرداخت هر قسط یک هزینه در حساب انتخاب‌شده ثبت می‌کند.
          </CardDescription>
        </div>
        <div className="shrink-0 text-end text-caption text-muted-foreground">
          <span className="tabular">{paidCount.toLocaleString("fa-IR")}</span> قسط
          پرداخت‌شده
        </div>
      </CardHeader>

      <ul className="divide-y divide-border">
        {visible.map((installment) => (
          <InstallmentRow
            key={installment.id}
            installment={installment}
            now={now}
            emphasised={installment.number === nextUnpaid?.number}
            disabled={loan.status === "ARCHIVED"}
            pending={pending === installment.number}
            onPay={() => void act(installment.number, "POST")}
            onUndo={() => void act(installment.number, "DELETE")}
          />
        ))}
      </ul>

      {hidden > 0 || showAll ? (
        <Button
          variant="ghost"
          onClick={() => {
            setShowAll((value) => !value);
          }}
        >
          {showAll ? <ChevronUp /> : <ChevronDown />}
          {showAll
            ? "نمایش فقط اقساط باقی‌مانده"
            : `نمایش همه ${loan.installments.length.toLocaleString("fa-IR")} قسط`}
        </Button>
      ) : null}
    </Card>
  );
}

function InstallmentRow({
  installment,
  now,
  emphasised,
  disabled,
  pending,
  onPay,
  onUndo,
}: {
  installment: InstallmentDto;
  now: Date;
  emphasised: boolean;
  disabled: boolean;
  pending: boolean;
  onPay: () => void;
  onUndo: () => void;
}) {
  const style = INSTALLMENT_STATUS_STYLE[installment.status];
  const Icon = style.icon;
  const paid = installment.status === "PAID";

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 py-3",
        emphasised && "-mx-3 rounded-md bg-primary-soft px-3",
      )}
    >
      <span className="tabular w-8 shrink-0 text-caption text-muted-foreground">
        {installment.number.toLocaleString("fa-IR")}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-body">
          {formatJalaliDate(new Date(installment.dueDate))}
        </span>
        <span className="text-caption text-muted-foreground">
          {paid && installment.paidAt
            ? `پرداخت در ${formatJalaliDate(new Date(installment.paidAt), { style: "medium" })}`
            : formatRelativeDay(new Date(installment.dueDate), { now })}
        </span>
      </span>

      <Badge variant={style.tone} className="shrink-0">
        <Icon />
        {INSTALLMENT_STATUS_LABELS[installment.status]}
      </Badge>

      <Money rial={installment.amount} className="ms-auto font-medium" unit={false} />

      {paid ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || disabled}
          onClick={onUndo}
        >
          <Undo2 />
          لغو
        </Button>
      ) : (
        <Button
          variant={emphasised ? "primary" : "secondary"}
          size="sm"
          disabled={pending || disabled}
          onClick={onPay}
        >
          <Check />
          پرداخت
        </Button>
      )}
    </li>
  );
}
