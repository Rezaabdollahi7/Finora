import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateAccountSchema } from "@/features/accounts/schemas";
import { getAccount, updateAccount } from "@/features/accounts/server/account-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/accounts/:id — account details. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const account = await getAccount(id);

    if (!account) return apiError("حساب پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ account });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/accounts/:id — update the editable fields. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateAccountSchema.parse(await readJsonBody(request));

    return NextResponse.json({ account: await updateAccount(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
