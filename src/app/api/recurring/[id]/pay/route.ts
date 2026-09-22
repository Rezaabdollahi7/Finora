import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { payOccurrenceSchema } from "@/features/recurring/schemas";
import {
  payOccurrence,
  unpayOccurrence,
} from "@/features/recurring/server/recurring-service";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/recurring/:id/pay — expected becomes paid (task 5.4).
 *
 * The expense and the occurrence are written in one database transaction.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = payOccurrenceSchema.parse(await readJsonBody(request));

    return NextResponse.json({ payment: await payOccurrence(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/recurring/:id/pay?dueDate=… — undo a payment.
 *
 * Removes the expense and the occurrence together. The transactions page
 * refuses to delete the expense on its own, because that would leave the
 * rule claiming a payment that no longer exists.
 */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const raw = new URL(request.url).searchParams.get("dueDate");
    const dueDate = raw ? new Date(raw) : null;

    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return apiError("تاریخ سررسید نامعتبر است.", "BAD_DUE_DATE", 400);
    }

    return NextResponse.json({ payment: await unpayOccurrence(id, dueDate) });
  } catch (error) {
    return handleApiError(error);
  }
}
