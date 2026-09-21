import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { assetFiltersSchema, createAssetSchema } from "@/features/assets/schemas";
import { createAsset, listAssets } from "@/features/assets/server/asset-service";

/** GET /api/assets — list assets, optionally filtered. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = assetFiltersSchema.parse({
      owner: params.get("owner") ?? undefined,
      type: params.get("type") ?? undefined,
      includeArchived: params.get("includeArchived") ?? undefined,
    });

    return NextResponse.json({ assets: await listAssets(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/assets — add an asset and open its valuation history. */
export async function POST(request: Request) {
  try {
    const input = createAssetSchema.parse(await readJsonBody(request));
    const asset = await createAsset(input);

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
