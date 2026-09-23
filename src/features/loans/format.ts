import { CalendarClock, CheckCircle2, Clock, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { InstallmentStatus } from "@/features/loans/schedule";
import type { LoanStatus } from "@/features/loans/types";

type Tone =
  "default" | "neutral" | "outline" | "solid" | "success" | "danger" | "warning";

/**
 * How each instalment state reads.
 *
 * Every state carries an icon as well as a colour, so the difference between
 * "paid" and "overdue" survives a reader who cannot separate green from red
 * (docs/DESIGN_SYSTEM.md §59.3).
 */
export const INSTALLMENT_STATUS_STYLE: Record<
  InstallmentStatus,
  { tone: Tone; icon: LucideIcon }
> = {
  PAID: { tone: "success", icon: CheckCircle2 },
  OVERDUE: { tone: "danger", icon: TriangleAlert },
  DUE: { tone: "warning", icon: Clock },
  UPCOMING: { tone: "neutral", icon: CalendarClock },
};

export const LOAN_STATUS_STYLE: Record<LoanStatus, Tone> = {
  ACTIVE: "default",
  SETTLED: "success",
  ARCHIVED: "outline",
};
