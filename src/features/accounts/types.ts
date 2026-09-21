import type { AccountType, Owner } from "@/generated/prisma/enums";

export type { AccountType, Owner };

/**
 * An account as it crosses a boundary — API response, server component prop,
 * client component state.
 *
 * Monetary values are strings here, not `bigint`: JSON cannot represent
 * `bigint`, and React cannot serialise it across the server/client boundary
 * either. They are decimal strings of whole Rial, parsed back with `BigInt()`
 * wherever arithmetic happens (rule G.2). They are never parsed with
 * `Number()`.
 */
export type AccountDto = {
  id: string;
  name: string;
  type: AccountType;
  owner: Owner;
  currency: string;
  /** Opening balance, in Rial. */
  initialBalance: string;
  /** initialBalance plus every transaction affecting this account, in Rial. */
  balance: string;
  /** Number of transactions recorded against this account. */
  transactionCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export const ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "WALLET",
  "INVESTMENT",
  "BUSINESS",
  "OTHER",
] as const satisfies readonly AccountType[];

export const OWNERS = ["SHARED", "REZA", "YEGANEH"] as const satisfies readonly Owner[];

/** The only currency the ledger supports; see the schema comment on Account. */
export const SUPPORTED_CURRENCIES = ["IRR"] as const;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  BANK: "بانکی",
  CASH: "نقد",
  WALLET: "کیف پول",
  INVESTMENT: "سرمایه‌گذاری",
  BUSINESS: "کسب‌وکار",
  OTHER: "سایر",
};

export const OWNER_LABELS: Record<Owner, string> = {
  SHARED: "مشترک",
  REZA: "رضا",
  YEGANEH: "یگانه",
};
