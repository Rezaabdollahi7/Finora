import {
  CheckCircle2,
  CircleAlert,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { BudgetAlertKind, BudgetState } from "@/features/budgets/tracking";

type Tone = "primary" | "success" | "warning" | "danger";

/**
 * How each budget state reads.
 *
 * Every state carries an icon as well as a colour, so the difference between
 * "comfortable" and "over" survives a reader who cannot separate green from
 * red (docs/DESIGN_SYSTEM.md §59.3).
 */
export const BUDGET_STATE_STYLE: Record<
  BudgetState,
  { tone: Tone; badge: "success" | "warning" | "danger"; icon: LucideIcon }
> = {
  NORMAL: { tone: "success", badge: "success", icon: CheckCircle2 },
  WARNING: { tone: "warning", badge: "warning", icon: CircleAlert },
  OVER: { tone: "danger", badge: "danger", icon: TriangleAlert },
};

export const BUDGET_ALERT_STYLE: Record<
  BudgetAlertKind,
  { tone: "warning" | "destructive"; icon: LucideIcon }
> = {
  NEAR_LIMIT: { tone: "warning", icon: CircleAlert },
  OVER_BUDGET: { tone: "destructive", icon: TriangleAlert },
  CASH_SHORTFALL: { tone: "destructive", icon: Wallet },
};
