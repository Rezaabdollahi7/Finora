import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { formatJalaliDate } from "@/utils/date";
import { CardLink } from "@/features/dashboard/components/bento";
import { TransactionAmount } from "@/features/transactions/components/transaction-amount";
import {
  TransactionIcon,
  transactionTitle,
} from "@/features/transactions/components/transaction-badges";
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionDto,
} from "@/features/transactions/types";

/**
 * The latest entries in the ledger (task 2.7).
 *
 * Rendered from the same icon, title and amount helpers as the transactions
 * page, so a row means the same thing in both places and there is one
 * definition of how an amount is coloured and signed (rule G.7).
 *
 * A server component: it only reads, and every row links into the page that
 * can act on it. Rows are separated by space and a hover wash rather than a
 * rule under every line.
 */
export function RecentTransactions({
  transactions,
}: {
  transactions: TransactionDto[];
}) {
  return (
    <Card variant="featured" className="h-full gap-4 p-6">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>تراکنش‌های اخیر</CardTitle>
          <CardDescription>آخرین درآمدها، هزینه‌ها و انتقال‌ها</CardDescription>
        </div>
        {transactions.length > 0 ? (
          <CardLink href="/transactions" label="همه تراکنش‌ها" />
        ) : null}
      </CardHeader>

      {transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="هنوز تراکنشی ثبت نشده"
          description="اولین درآمد یا هزینه خود را ثبت کنید تا اینجا نمایش داده شود."
          action={
            <Button asChild>
              <Link href="/transactions">ثبت تراکنش</Link>
            </Button>
          }
        />
      ) : (
        <ul className="-mx-3 flex flex-col gap-1">
          {transactions.map((transaction) => (
            <li key={transaction.id}>
              <Link
                href="/transactions"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-muted"
              >
                <TransactionIcon transaction={transaction} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {transactionTitle(transaction)}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {transaction.categoryName ??
                      TRANSACTION_TYPE_LABELS[transaction.type]}
                    {" · "}
                    {transaction.accountName}
                    {" · "}
                    {formatJalaliDate(new Date(transaction.date), { style: "medium" })}
                  </span>
                </span>
                <TransactionAmount
                  transaction={transaction}
                  className="shrink-0 font-medium"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
