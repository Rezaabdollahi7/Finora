import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { removeContribution } from "@/features/goals/server/goal-service";

/** DELETE /api/goals/:id/contributions/:contributionId — undo one. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; contributionId: string }> },
) {
  try {
    const { id, contributionId } = await params;

    return NextResponse.json({ goal: await removeContribution(id, contributionId) });
  } catch (error) {
    return handleApiError(error);
  }
}
