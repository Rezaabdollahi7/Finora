import { NextResponse } from "next/server";
import { z } from "zod";

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
const bodySchema = z.object({
  isActive: z.boolean({ message: "وضعیت فعال بودن باید درست یا نادرست باشد." }),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Validated rather than coerced. `body.isActive !== false` accepted a
    // string, a number or a missing field as "switch it on", which is the
    // one endpoint in the API that was reading an untrusted body without a
    // schema to hold it to (task 8.18).
    const { isActive } = bodySchema.parse(await readJsonBody(request));

    return NextResponse.json({
      payment: await setRecurringPaymentActive(id, isActive),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
