import type {
  AssetKind,
  AssetType,
  Owner,
  ValuationSource,
} from "@/generated/prisma/enums";

export type { AssetKind, AssetType, ValuationSource };

export const ASSET_TYPES = [
  "GOLD",
  "USD",
  "EUR",
  "CAR",
  "STOCK",
  "CRYPTO",
  "PROPERTY",
  "OTHER",
] as const satisfies readonly AssetType[];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  GOLD: "طلا",
  USD: "دلار",
  EUR: "یورو",
  CAR: "خودرو",
  STOCK: "سهام",
  CRYPTO: "رمزارز",
  PROPERTY: "ملک",
  OTHER: "سایر",
};

/**
 * Whether a type is priced per unit or valued as a whole (tasks 3.3, 3.4).
 *
 * Derived from the type rather than asked of the user: a car is never a
 * per-unit holding, and a gram of gold is never a single indivisible thing.
 * Making it a second question would only create the chance of a contradictory
 * answer.
 *
 * OTHER sits on the fixed side because that is where the roadmap puts it
 * (task 3.4) and because it is the side that needs no unit label — anything
 * genuinely counted in units has a type of its own here.
 */
export const ASSET_KIND_BY_TYPE: Record<AssetType, AssetKind> = {
  GOLD: "QUANTITY",
  USD: "QUANTITY",
  EUR: "QUANTITY",
  STOCK: "QUANTITY",
  CRYPTO: "QUANTITY",
  CAR: "FIXED",
  PROPERTY: "FIXED",
  OTHER: "FIXED",
};

/** What the form offers as the unit, when the type implies one. */
export const DEFAULT_ASSET_UNIT: Partial<Record<AssetType, string>> = {
  GOLD: "گرم",
  USD: "دلار",
  EUR: "یورو",
  STOCK: "سهم",
  CRYPTO: "واحد",
};

export function assetKindOf(type: AssetType): AssetKind {
  return ASSET_KIND_BY_TYPE[type];
}

export function isQuantityAsset(type: AssetType): boolean {
  return assetKindOf(type) === "QUANTITY";
}

/**
 * An asset as it crosses a boundary.
 *
 * Monetary values are decimal strings of whole Rial and quantities are
 * decimal strings of the 10^8-scaled integer, for the same reason every other
 * DTO does it: JSON has no bigint, and neither does the server/client
 * boundary. They are parsed back with `BigInt()`, never `Number()`
 * (rule G.2).
 */
export type AssetDto = {
  id: string;
  name: string;
  type: AssetType;
  kind: AssetKind;
  owner: Owner;
  /** Scaled by 10^8; see utils/quantity. Always "100000000" for FIXED. */
  quantity: string;
  unit: string | null;
  /** Rial paid per unit at acquisition. */
  purchaseUnitPrice: string;
  /** quantity × purchaseUnitPrice, in Rial — the cost basis for P/L (3.6). */
  purchaseTotal: string;
  /**
   * Rial per unit as of the latest valuation. Equals the purchase price until
   * the first re-pricing, so a freshly added asset shows no phantom gain.
   */
  currentUnitPrice: string;
  /** quantity × currentUnitPrice, in Rial (task 3.5). */
  currentValue: string;
  /** currentValue − purchaseTotal, in Rial. Negative is a loss (task 3.6). */
  profitLoss: string;
  /**
   * profitLoss ÷ purchaseTotal. A display ratio, so a float is fine — the
   * amounts beside it stay exact. Null when the cost basis is zero, because
   * a return on nothing is not a number worth showing.
   */
  returnRatio: number | null;
  /** ISO instant of the latest valuation, or null if never re-priced. */
  lastValuedAt: string | null;
  purchaseDate: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** One recorded valuation (task 3.8). */
export type AssetValuationDto = {
  id: string;
  assetId: string;
  unitPrice: string;
  quantity: string;
  value: string;
  asOf: string;
  source: ValuationSource;
  note: string | null;
};

/** One row of the portfolio's type breakdown (task 3.7). */
export type AssetTypeShare = {
  type: AssetType;
  label: string;
  value: string;
  count: number;
  /** Share of the portfolio's total value, 0–1. */
  share: number;
};

/** The figures at the top of the portfolio page (tasks 3.5–3.7). */
export type PortfolioSummary = {
  /** Total current value of active assets, in Rial. */
  totalValue: string;
  /** Total cost basis of active assets, in Rial. */
  totalCost: string;
  profitLoss: string;
  returnRatio: number | null;
  assetCount: number;
  byType: AssetTypeShare[];
};

/** One point on an asset's value history (task 3.8). */
export type AssetHistoryPoint = {
  at: string;
  label: string;
  value: string;
  unitPrice: string;
};
