import { CheckCircle2, CircleDot, TriangleAlert, type LucideIcon } from "lucide-react";

import type { GoalState, GoalStatus } from "@/features/goals/types";

type Tone = "primary" | "success" | "warning" | "danger";
type BadgeTone =
  "default" | "neutral" | "outline" | "solid" | "success" | "danger" | "warning";

/**
 * How each goal state reads.
 *
 * Every state carries an icon as well as a colour, so the difference between
 * "reached" and "past its date" survives a reader who cannot separate green
 * from red (docs/DESIGN_SYSTEM.md §59.3).
 */
export const GOAL_STATE_STYLE: Record<
  GoalState,
  { tone: Tone; badge: BadgeTone; icon: LucideIcon }
> = {
  IN_PROGRESS: { tone: "primary", badge: "default", icon: CircleDot },
  REACHED: { tone: "success", badge: "success", icon: CheckCircle2 },
  OVERDUE: { tone: "danger", badge: "danger", icon: TriangleAlert },
};

export const GOAL_STATUS_STYLE: Record<GoalStatus, BadgeTone> = {
  ACTIVE: "default",
  COMPLETED: "success",
  ARCHIVED: "outline",
};
