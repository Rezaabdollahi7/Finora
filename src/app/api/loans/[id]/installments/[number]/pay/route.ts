import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { payInstallmentSchema } from "@/features/loans/schemas";
import { payInstallment, unpayInstallment } from "@/features/loans/server/loan-service";

type Context = { params: Promise<{ id: string; number: string }> };

async function installmentNumber(params: Context["params"]) {
  const { id, number } = await params;
  const parsed = Number(number);

  return { id, number: Number.isInteger(parsed) && parsed > 0 ? parsed : null };
}

/**
 * POST /api/loans/:id/installments/:number/pay
 *
 * Records the expense and marks the instalment paid, in one database
 * transaction (task 4.4).
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { id, number } = await installmentNumber(params);

    if (number === null) return apiError("شماره قسط نامعتبر است.", "BAD_NUMBER", 400);

    const input = payInstallmentSchema.parse(await readJsonBody(request));

    return NextResponse.json({ loan: await payInstallment(id, number, input) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/loans/:id/installments/:number/pay — undo the payment.
 *
 * Removes the expense and clears the instalment together. The transactions
 * page deliberately refuses to delete a loan payment on its own, because
 * doing so would leave the schedule claiming a payment that no longer exists.
 */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id, number } = await installmentNumber(params);

    if (number === null) return apiError("شماره قسط نامعتبر است.", "BAD_NUMBER", 400);

    return NextResponse.json({ loan: await unpayInstallment(id, number) });
  } catch (error) {
    return handleApiError(error);
  }
}
