import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { restoreGoal } from "@/features/goals/server/goal-service";

/** POST /api/goals/:id/restore — bring a goal back out of the archive. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    return NextResponse.json({ goal: await restoreGoal(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
