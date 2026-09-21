import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Archive } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { ACCOUNT_TYPE_ICONS } from "@/features/accounts/format";
import { AccountActions } from "@/features/accounts/components/account-actions";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { ACCOUNT_TYPE_LABELS, type AccountDto } from "@/features/accounts/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-body text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium">{children}</dd>
    </div>
  );
}

function AccountDetail({ account }: { account: AccountDto }) {
  const Icon = ACCOUNT_TYPE_ICONS[account.type];

  return (
    <div className="space-y-6">
      {!account.isActive ? (
        <Alert variant="warning">
          <Archive />
          <AlertTitle>این حساب بایگانی شده است</AlertTitle>
          <AlertDescription>
            تراکنش‌های گذشته آن حفظ شده‌اند، اما تا زمانی که از بایگانی خارج نشود قابل
            ویرایش نیست.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card variant="ink" padding="large" className="gap-2">
        <span className="flex items-center gap-3 text-body text-ink-surface-muted">
          <Icon className="size-[18px]" />
          موجودی فعلی
        </span>
        <Money rial={account.balance} className="text-display" unit={false} />
        <span className="text-caption text-ink-surface-subtle">تومان</span>
      </Card>

      <Card variant="featured">
        <dl>
          <Field label="نوع حساب">{ACCOUNT_TYPE_LABELS[account.type]}</Field>
          <Field label="مالک">
            <OwnerBadge owner={account.owner} />
          </Field>
          <Field label="موجودی اولیه">
            <Money rial={account.initialBalance} />
          </Field>
          <Field label="تعداد تراکنش">
            {account.transactionCount.toLocaleString("fa-IR")}
          </Field>
          <Field label="واحد پول">{account.currency}</Field>
          <Field label="تاریخ ایجاد">
            {formatJalaliDate(new Date(account.createdAt))}
          </Field>
        </dl>
      </Card>

      <AccountActions account={account} />
    </div>
  );
}

export { AccountDetail };
