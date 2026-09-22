import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { archiveGoal } from "@/features/goals/server/goal-service";

/**
 * POST /api/goals/:id/archive
 *
 * There is no DELETE. A goal's contributions are the record of what the
 * household set aside, and removing the goal would take that history with it
 * (rule G.4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    return NextResponse.json({ goal: await archiveGoal(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
