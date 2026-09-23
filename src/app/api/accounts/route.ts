import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { accountFiltersSchema, createAccountSchema } from "@/features/accounts/schemas";
import {
  createAccount,
  listAccounts,
} from "@/features/accounts/server/account-service";

/** GET /api/accounts — list accounts, optionally filtered. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = accountFiltersSchema.parse({
      owner: params.get("owner") ?? undefined,
      type: params.get("type") ?? undefined,
      includeArchived: params.get("includeArchived") ?? undefined,
    });

    return NextResponse.json({ accounts: await listAccounts(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/accounts — create an account. */
export async function POST(request: Request) {
  try {
    const input = createAccountSchema.parse(await readJsonBody(request));
    const account = await createAccount(input);

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
