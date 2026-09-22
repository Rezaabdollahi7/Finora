import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateLoanSchema } from "@/features/loans/schemas";
import { getLoan, updateLoan } from "@/features/loans/server/loan-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/loans/:id — the loan and its whole schedule. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const loan = await getLoan(id);

    if (!loan) return apiError("وام پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ loan });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/loans/:id
 *
 * Changing anything the schedule is built from regenerates the unpaid
 * instalments and leaves the paid ones untouched (rule G.4).
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateLoanSchema.parse(await readJsonBody(request));

    return NextResponse.json({ loan: await updateLoan(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
