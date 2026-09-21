import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { archiveAccount } from "@/features/accounts/server/account-service";

/**
 * POST /api/accounts/:id/archive
 *
 * Archiving has its own endpoint rather than being a field on PATCH, so it
 * cannot happen as a side effect of an unrelated edit and the intent is
 * visible in the request itself. There is no DELETE: accounts are never
 * removed, because their financial history has to stay readable (rule G.4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ account: await archiveAccount(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
