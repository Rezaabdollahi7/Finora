import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { completeGoal, reopenGoal } from "@/features/goals/server/goal-service";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/goals/:id/complete — mark a goal finished by hand.
 *
 * Separate from reaching the target, which completes a goal on its own.
 * Deciding the holiday fund is enough at 80% is a real decision, and this is
 * where it is made.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { id } = await params;

    return NextResponse.json({ goal: await completeGoal(id) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/goals/:id/complete — reopen it. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;

    return NextResponse.json({ goal: await reopenGoal(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
