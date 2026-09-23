import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { restoreLoan } from "@/features/loans/server/loan-service";

/** POST /api/loans/:id/restore — bring an archived loan back. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ loan: await restoreLoan(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
