import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, resolveIconKey } from "@/features/categories/icons";
import type { TransactionDto, TransactionType } from "@/features/transactions/types";

/**
 * The icon that says what kind of movement this is.
 *
 * Income and expense take the semantic colours; a transfer takes the neutral
 * primary, because it is neither earning nor spending (rule G.3) and colouring
 * it red would read as money lost.
 */
export function TypeIcon({
  type,
  className,
}: {
  type: TransactionType;
  className?: string;
}) {
  const Icon =
    type === "INCOME"
      ? ArrowDownLeft
      : type === "EXPENSE"
        ? ArrowUpRight
        : ArrowLeftRight;

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        type === "INCOME" && "bg-success-subtle text-success",
        type === "EXPENSE" && "bg-danger-subtle text-danger",
        type === "TRANSFER" && "bg-primary-soft text-primary",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/**
 * The category icon, or the type icon when there is no category.
 *
 * A transfer never has one, and an income or expense may not have been
 * classified yet, so this always renders something rather than leaving a gap
 * in the row.
 */
export function TransactionIcon({ transaction }: { transaction: TransactionDto }) {
  if (!transaction.categoryId) return <TypeIcon type={transaction.type} />;

  const Icon = CATEGORY_ICONS[resolveIconKey(transaction.categoryIcon)];

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        transaction.type === "INCOME"
          ? "bg-success-subtle text-success"
          : "bg-primary-soft text-primary",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/** What the row is about: its description, or a sensible stand-in. */
export function transactionTitle(transaction: TransactionDto): string {
  if (transaction.description) return transaction.description;
  if (transaction.type === "TRANSFER") {
    return `انتقال به ${transaction.toAccountName ?? "حساب دیگر"}`;
  }

  return (
    transaction.categoryName ?? (transaction.type === "INCOME" ? "درآمد" : "هزینه")
  );
}
