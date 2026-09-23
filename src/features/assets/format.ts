import {
  Banknote,
  Bitcoin,
  Building2,
  Car,
  Coins,
  DollarSign,
  Euro,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { AssetType } from "@/features/assets/types";

/** One icon per asset type, so the portfolio is scannable without reading. */
export const ASSET_TYPE_ICONS: Record<AssetType, LucideIcon> = {
  GOLD: Coins,
  USD: DollarSign,
  EUR: Euro,
  CAR: Car,
  STOCK: TrendingUp,
  CRYPTO: Bitcoin,
  PROPERTY: Building2,
  OTHER: Banknote,
};
