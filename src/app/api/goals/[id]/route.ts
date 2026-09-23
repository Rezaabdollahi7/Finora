import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateGoalSchema } from "@/features/goals/schemas";
import { getGoal, updateGoal } from "@/features/goals/server/goal-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/goals/:id — the goal and its contribution history. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const goal = await getGoal(id);

    if (!goal) return apiError("هدف پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ goal });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/goals/:id
 *
 * Status is not a field here. Archiving, completing and reopening have their
 * own endpoints so none of them can happen as a side effect of an edit.
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateGoalSchema.parse(await readJsonBody(request));

    return NextResponse.json({ goal: await updateGoal(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
