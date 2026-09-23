import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { createContributionSchema } from "@/features/goals/schemas";
import { addContribution } from "@/features/goals/server/goal-service";

/**
 * POST /api/goals/:id/contributions — put money aside, or take some back out.
 *
 * No transaction is written. A contribution earmarks money the household
 * already has rather than moving any, so counting it as an expense would cut
 * net worth every time the household saved (rule G.3).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const input = createContributionSchema.parse(await readJsonBody(request));

    return NextResponse.json({ goal: await addContribution(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
