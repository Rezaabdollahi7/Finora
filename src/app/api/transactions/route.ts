import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import {
  createTransactionSchema,
  transactionFiltersSchema,
} from "@/features/transactions/schemas";
import {
  createTransaction,
  listTransactions,
} from "@/features/transactions/server/transaction-service";

/** GET /api/transactions — paginated list, filtered and searchable. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = transactionFiltersSchema.parse({
      type: params.get("type") ?? undefined,
      accountId: params.get("accountId") ?? undefined,
      owner: params.get("owner") ?? undefined,
      search: params.get("search") ?? undefined,
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });

    return NextResponse.json(await listTransactions(filters));
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/transactions — record a transaction. */
export async function POST(request: Request) {
  try {
    const input = createTransactionSchema.parse(await readJsonBody(request));
    const transaction = await createTransaction(input);

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
