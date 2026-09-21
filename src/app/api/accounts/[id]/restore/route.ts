import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { restoreAccount } from "@/features/accounts/server/account-service";

/** POST /api/accounts/:id/restore — bring an archived account back. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ account: await restoreAccount(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
