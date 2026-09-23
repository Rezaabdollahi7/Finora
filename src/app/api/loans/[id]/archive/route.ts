import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { archiveLoan } from "@/features/loans/server/loan-service";

/**
 * POST /api/loans/:id/archive
 *
 * There is no DELETE: the expenses a loan's payments created are real
 * transactions in the ledger, and removing the loan would leave them
 * unexplained (rule G.4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ loan: await archiveLoan(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
