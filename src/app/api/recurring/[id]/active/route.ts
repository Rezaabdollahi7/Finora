import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { setRecurringPaymentActive } from "@/features/recurring/server/recurring-service";

/**
 * POST /api/recurring/:id/active — switch a rule on or off.
 *
 * Its own endpoint rather than a field on PATCH, so it cannot happen as a
 * side effect of an unrelated edit. There is no DELETE: the expenses a rule's
 * payments created are real transactions, and removing the rule would leave
 * them unexplained (rule G.4).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await readJsonBody(request)) as { isActive?: unknown };
    const isActive = body.isActive !== false;

    return NextResponse.json({
      payment: await setRecurringPaymentActive(id, isActive),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
