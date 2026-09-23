import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Archive } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FactGrid } from "@/components/common/fact-grid";
import { HeroCard } from "@/components/common/hero-card";
import { Money } from "@/components/common/money";
import { formatJalaliDate } from "@/utils/date";
import { ACCOUNT_TYPE_ICONS } from "@/features/accounts/format";
import { AccountActions } from "@/features/accounts/components/account-actions";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { ACCOUNT_TYPE_LABELS, type AccountDto } from "@/features/accounts/types";

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

      <HeroCard
        label="موجودی فعلی"
        icon={Icon}
        value={account.balance}
        negative={BigInt(account.balance) < 0n}
        meta={<span>{ACCOUNT_TYPE_LABELS[account.type]}</span>}
        stats={[
          { label: "موجودی اولیه", rial: account.initialBalance },
          {
            label: "تراکنش‌ها",
            content: account.transactionCount.toLocaleString("fa-IR"),
          },
        ]}
      />

      <Card
        variant="featured"
        className="reveal gap-5 p-6"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>مشخصات حساب</CardTitle>
        </CardHeader>
        <FactGrid
          facts={[
            { label: "نوع حساب", value: ACCOUNT_TYPE_LABELS[account.type] },
            { label: "مالک", value: <OwnerBadge owner={account.owner} /> },
            { label: "موجودی اولیه", value: <Money rial={account.initialBalance} /> },
            {
              label: "تعداد تراکنش",
              value: account.transactionCount.toLocaleString("fa-IR"),
            },
            { label: "واحد پول", value: account.currency },
            {
              label: "تاریخ ایجاد",
              value: formatJalaliDate(new Date(account.createdAt)),
            },
          ]}
        />
      </Card>

      <AccountActions account={account} />
    </div>
  );
}

export { AccountDetail };
