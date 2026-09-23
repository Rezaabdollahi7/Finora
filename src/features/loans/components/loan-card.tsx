import Link from "next/link";
import { Landmark } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatJalaliDate, formatRelativeDay } from "@/utils/date";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { LOAN_STATUS_STYLE } from "@/features/loans/format";
import { LoanProgressBar } from "@/features/loans/components/loan-progress";
import { LOAN_STATUS_LABELS, type LoanDto } from "@/features/loans/types";

/**
 * One loan in the list.
 *
 * What is still owed dominates — that is the figure a household acts on —
 * with the progress underneath and the next due date last. The whole card is
 * the link, so the tap target on a phone is the card and not a word inside
 * it (rule G.10).
 */
export function LoanCard({ loan, now }: { loan: LoanDto; now: Date }) {
  const archived = loan.status === "ARCHIVED";
  const nextDue = loan.progress.nextDueDate
    ? new Date(loan.progress.nextDueDate)
    : null;
  const isLate = loan.progress.overdue > 0;

  return (
    <Card
      variant="compact"
      padding="none"
      className={cn(
        "transition-shadow duration-150 ease-out hover:shadow-md",
        archived && "opacity-70",
      )}
    >
      <Link
        href={`/loans/${loan.id}`}
        className="flex h-full flex-col gap-4 rounded-md p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Landmark className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{loan.name}</span>
              <span className="truncate text-caption text-muted-foreground">
                {loan.provider}
              </span>
            </span>
          </span>
          <OwnerBadge owner={loan.owner} />
        </div>

        <div className="space-y-1">
          <span className="text-caption text-muted-foreground">مانده بدهی</span>
          <Money
            rial={loan.progress.remainingAmount}
            className="block text-h2 font-bold"
          />
        </div>

        <LoanProgressBar progress={loan.progress} showAmounts={false} />

        <div className="mt-auto flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
          {nextDue ? (
            <span
              className={cn(
                "flex items-center gap-1.5",
                // An instalment whose date has passed is not "next", it is
                // late. Labelling it "قسط بعدی · ۵۷ روز پیش" reads as a
                // contradiction and buries the thing that needs acting on.
                isLate && "text-danger",
              )}
            >
              <span>{isLate ? "سررسید گذشته" : "قسط بعدی"}</span>
              <span>{formatJalaliDate(nextDue, { style: "medium" })}</span>
              <span aria-hidden>·</span>
              <span>{formatRelativeDay(nextDue, { now })}</span>
            </span>
          ) : (
            <span>همه اقساط پرداخت شده است</span>
          )}

          {loan.status === "ACTIVE" ? null : (
            <Badge variant={LOAN_STATUS_STYLE[loan.status]} className="ms-auto">
              {LOAN_STATUS_LABELS[loan.status]}
            </Badge>
          )}
        </div>
      </Link>
    </Card>
  );
}
