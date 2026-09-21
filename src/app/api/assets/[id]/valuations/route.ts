import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { recordValuationSchema } from "@/features/assets/schemas";
import {
  listValuations,
  recordValuation,
} from "@/features/assets/server/asset-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/assets/:id/valuations — the recorded history, oldest first. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json({ valuations: await listValuations(id) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/assets/:id/valuations — record what the asset is worth now.
 *
 * A POST rather than a PATCH on the asset, because that is what it is: a new
 * fact appended to the history, not a field overwritten (task 3.8).
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = recordValuationSchema.parse(await readJsonBody(request));

    return NextResponse.json(
      { valuation: await recordValuation(id, input) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
