import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateAssetSchema } from "@/features/assets/schemas";
import { getAsset, updateAsset } from "@/features/assets/server/asset-service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/assets/:id — asset details. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const asset = await getAsset(id);

    if (!asset) return apiError("دارایی پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/assets/:id — update the editable fields. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateAssetSchema.parse(await readJsonBody(request));

    return NextResponse.json({ asset: await updateAsset(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
