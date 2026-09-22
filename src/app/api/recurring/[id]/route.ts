import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateRecurringPaymentSchema } from "@/features/recurring/schemas";
import {
  getRecurringPayment,
  updateRecurringPayment,
} from "@/features/recurring/server/recurring-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/recurring/:id — the rule and the occurrences around today. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const payment = await getRecurringPayment(id);

    if (!payment) return apiError("پرداخت دوره‌ای پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ payment });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/recurring/:id
 *
 * Changes what is still expected. Occurrences already paid are rows and are
 * not touched (rule G.4).
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateRecurringPaymentSchema.parse(await readJsonBody(request));

    return NextResponse.json({ payment: await updateRecurringPayment(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
