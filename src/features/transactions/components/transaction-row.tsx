"use client";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatJalaliDate } from "@/utils/date";
import { OWNER_LABELS } from "@/features/accounts/types";
import { TransactionAmount } from "@/features/transactions/components/transaction-amount";
import {
  TransactionIcon,
  transactionTitle,
} from "@/features/transactions/components/transaction-badges";
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionDto,
} from "@/features/transactions/types";

/** One transaction as a table row. Desktop and tablet; phones get cards. */
export function TransactionRow({
  transaction,
  onSelect,
}: {
  transaction: TransactionDto;
  onSelect: (transaction: TransactionDto) => void;
}) {
  return (
    <TableRow
      tabIndex={0}
      role="button"
      className="cursor-pointer"
      onClick={() => {
        onSelect(transaction);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(transaction);
        }
      }}
    >
      <TableCell>
        <span className="flex items-center gap-3">
          <TransactionIcon transaction={transaction} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {transactionTitle(transaction)}
            </span>
            <span className="truncate text-caption text-muted-foreground">
              {transaction.categoryName ?? TRANSACTION_TYPE_LABELS[transaction.type]}
            </span>
          </span>
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {transaction.type === "TRANSFER"
          ? `${transaction.accountName} ← ${transaction.toAccountName ?? ""}`
          : transaction.accountName}
      </TableCell>
      <TableCell>
        <Badge variant={transaction.owner === "SHARED" ? "default" : "neutral"}>
          {OWNER_LABELS[transaction.owner]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatJalaliDate(new Date(transaction.date), { style: "medium" })}
      </TableCell>
      <TableCell className="text-end">
        <TransactionAmount transaction={transaction} className="font-bold" />
      </TableCell>
    </TableRow>
  );
}

/** One transaction as a card. Phones; the table would force zooming. */
export function TransactionCard({
  transaction,
  onSelect,
}: {
  transaction: TransactionDto;
  onSelect: (transaction: TransactionDto) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(transaction);
      }}
      className="flex w-full items-center gap-3 rounded-md border border-border bg-card p-4 text-start transition-colors hover:bg-primary-subtle"
    >
      <TransactionIcon transaction={transaction} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{transactionTitle(transaction)}</span>
        <span className="truncate text-caption text-muted-foreground">
          {transaction.accountName}
          {" · "}
          {formatJalaliDate(new Date(transaction.date), { style: "medium" })}
        </span>
      </span>
      <TransactionAmount transaction={transaction} className="shrink-0 font-bold" />
    </button>
  );
}
