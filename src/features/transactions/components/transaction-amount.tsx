import { Money } from "@/components/common/money";
import type { TransactionDto } from "@/features/transactions/types";

/**
 * A transaction's amount, signed for reading.
 *
 * The stored amount is always positive (rule G.2), so the sign shown here is
 * derived from the type. A transfer gets no sign and no semantic colour: it
 * is neither income nor expense (rule G.3), and the design system warns
 * against turning every outgoing row red (§25).
 */
export function TransactionAmount({
  transaction,
  className,
}: {
  transaction: TransactionDto;
  className?: string;
}) {
  const { type, amount } = transaction;

  if (type === "TRANSFER") {
    return <Money rial={amount} tone="muted" className={className} />;
  }

  const signed = type === "INCOME" ? amount : `-${amount}`;

  return (
    <Money
      rial={signed}
      tone={type === "INCOME" ? "positive" : "negative"}
      signed
      className={className}
    />
  );
}
