import {
  Briefcase,
  Banknote,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { AccountType } from "@/features/accounts/types";

/** One icon per account type, so a list is scannable without reading labels. */
export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  BANK: Landmark,
  CASH: Banknote,
  WALLET: Wallet,
  INVESTMENT: TrendingUp,
  BUSINESS: Briefcase,
  OTHER: PiggyBank,
};
