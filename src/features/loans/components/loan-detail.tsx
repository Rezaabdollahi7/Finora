import { Archive, Landmark } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { formatPercent } from "@/utils/number";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import type { AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { InstallmentList } from "@/features/loans/components/installment-list";
import { LoanActions } from "@/features/loans/components/loan-actions";
import { LoanProgressBar } from "@/features/loans/components/loan-progress";
import { loanInterestTotal, type LoanDetailDto } from "@/features/loans/types";

/**
 * One fact of the record as a small tile (§0.13), the same shape as
 * FactGrid's, kept local so the conditional rows above can stay inline.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-4 py-3">
      <dt className="truncate text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body font-medium break-words">{children}</dd>
    </div>
  );
}

/** One loan in full: what is left, how far along, and every instalment. */
export function LoanDetail({
  loan,
  accounts,
  categories,
  now,
}: {
  loan: LoanDetailDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  now: Date;
}) {
  const interest = loanInterestTotal(loan);

  return (
    <div className="space-y-6">
      {loan.status === "ARCHIVED" ? (
        <Alert variant="warning">
          <Archive />
          <AlertTitle>این وام بایگانی شده است</AlertTitle>
          <AlertDescription>
            اقساط و هزینه‌های ثبت‌شده آن حفظ شده‌اند، اما در تقویم و پرداخت‌های پیش‌رو
            دیده نمی‌شود و قسط جدیدی نمی‌توان پرداخت کرد.
          </AlertDescription>
        </Alert>
      ) : null}

      <HeroCard
        label="مانده بدهی"
        icon={Landmark}
        value={loan.progress.remainingAmount}
        meta={
          <span>
            {loan.progress.paid.toLocaleString("fa-IR")} از{" "}
            {loan.progress.total.toLocaleString("fa-IR")} قسط پرداخت شده
          </span>
        }
        stats={[
          { label: "پرداخت‌شده", rial: loan.progress.paidAmount },
          ...(loan.progress.overdue > 0
            ? [{ label: "معوق", rial: loan.progress.overdueAmount, alert: true }]
            : []),
        ]}
      />

      <Card variant="featured">
        <LoanProgressBar progress={loan.progress} />
      </Card>

      <LoanActions loan={loan} accounts={accounts} categories={categories} />

      <Card variant="featured" className="reveal gap-5 p-6">
        <h2 className="text-h4">مشخصات</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="وام‌دهنده">{loan.provider}</Field>
          <Field label="مالک">
            <OwnerBadge owner={loan.owner} always />
          </Field>
          <Field label="مبلغ وام">
            <Money rial={loan.principalAmount} />
          </Field>
          <Field label="نرخ سود سالانه">
            {/* Basis points back to a percentage for display. */}
            <span className="tabular" dir="ltr">
              {formatPercent(loan.interestRate / 10_000, { fractionDigits: 1 })}
            </span>
          </Field>
          <Field label="مبلغ هر قسط">
            <Money rial={loan.installmentAmount} />
          </Field>
          <Field label="مجموع بازپرداخت">
            <Money rial={loan.progress.totalAmount} />
          </Field>
          {/*
            A repayment total below the principal is not negative interest,
            it is arithmetic that does not add up — almost always a mistyped
            instalment or count. Printing "سود پرداختی: −۸,۰۰۰,۰۰۰" would
            dress a data-entry slip up as a finding.
          */}
          {BigInt(interest) < 0n ? (
            <Field label="مجموع بازپرداخت">
              <span className="flex flex-col items-end gap-1 text-end">
                <span className="text-danger">کمتر از مبلغ وام است</span>
                <span className="text-caption font-normal text-muted-foreground">
                  مبلغ قسط یا تعداد اقساط را بررسی کنید
                </span>
              </span>
            </Field>
          ) : (
            <Field label="سود پرداختی">
              <Money rial={interest} />
            </Field>
          )}
          <Field label="روز پرداخت هر ماه">
            <span className="tabular">{loan.paymentDay.toLocaleString("fa-IR")}</span>
          </Field>
          <Field label="تاریخ شروع">{formatJalaliDate(new Date(loan.startDate))}</Field>
          <Field label="تاریخ پایان">{formatJalaliDate(new Date(loan.endDate))}</Field>
          <Field label="حساب پرداخت">{loan.accountName ?? "انتخاب نشده"}</Field>
          <Field label="دسته‌بندی هزینه">{loan.categoryName ?? "بدون دسته"}</Field>
          {loan.notes ? <Field label="یادداشت">{loan.notes}</Field> : null}
        </dl>
      </Card>

      <InstallmentList loan={loan} accounts={accounts} now={now} />
    </div>
  );
}
