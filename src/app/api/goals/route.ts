import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { createGoalSchema, goalFiltersSchema } from "@/features/goals/schemas";
import { createGoal, listGoals } from "@/features/goals/server/goal-service";

/** GET /api/goals — the goals, optionally including archived ones. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = goalFiltersSchema.parse({
      owner: params.get("owner") ?? undefined,
      status: params.get("status") ?? undefined,
      includeArchived: params.get("includeArchived") ?? undefined,
    });

    return NextResponse.json({ goals: await listGoals(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/goals — add a goal. */
export async function POST(request: Request) {
  try {
    const input = createGoalSchema.parse(await readJsonBody(request));

    return NextResponse.json({ goal: await createGoal(input) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
