import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateTransactionSchema } from "@/features/transactions/schemas";
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/transactions/:id — details. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const transaction = await getTransaction(id);

    if (!transaction) return apiError("تراکنش پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ transaction });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/transactions/:id — replace the transaction.
 *
 * Deliberately a replace rather than a PATCH: a partial edit could change a
 * type without its destination changing with it, and every such combination
 * would need its own rule. Replacing keeps one set of invariants.
 */
export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateTransactionSchema.parse(await readJsonBody(request));

    return NextResponse.json({ transaction: await updateTransaction(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/transactions/:id
 *
 * Unlike accounts, transactions really are deleted: a mistyped entry is noise
 * in every report until it is gone, and nothing references it.
 */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deleteTransaction(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
