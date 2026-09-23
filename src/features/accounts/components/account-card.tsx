import Link from "next/link";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/common/money";
import { ACCOUNT_TYPE_ICONS } from "@/features/accounts/format";
import { OwnerBadge } from "@/features/accounts/components/owner-badge";
import { ACCOUNT_TYPE_LABELS, type AccountDto } from "@/features/accounts/types";

/**
 * One account in the list.
 *
 * The balance dominates, the name and type sit under it, and the metadata
 * comes last — the hierarchy the design system asks for (§1.3). The whole
 * card is a link, so the tap target on a phone is the card rather than a
 * word inside it.
 */
function AccountCard({ account }: { account: AccountDto }) {
  const Icon = ACCOUNT_TYPE_ICONS[account.type];

  return (
    <Card
      padding="none"
      className={cn("hover-lift h-full", !account.isActive && "opacity-70")}
    >
      <Link
        href={`/accounts/${account.id}`}
        className="flex h-full flex-col gap-5 rounded-xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold">{account.name}</span>
              <span className="text-caption text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </span>
            </span>
          </span>
          <OwnerBadge owner={account.owner} />
        </div>

        <Money
          rial={account.balance}
          tone={BigInt(account.balance) < 0n ? "negative" : "default"}
          className="text-h2 font-light tracking-tight"
        />

        <div className="mt-auto flex items-center gap-2 text-caption text-muted-foreground">
          <span>
            {account.transactionCount === 0
              ? "بدون تراکنش"
              : `${account.transactionCount.toLocaleString("fa-IR")} تراکنش`}
          </span>
          {!account.isActive ? (
            <Badge variant="outline" className="ms-auto">
              بایگانی‌شده
            </Badge>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}

export { AccountCard };
