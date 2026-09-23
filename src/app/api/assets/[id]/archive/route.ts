import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { archiveAsset } from "@/features/assets/server/asset-service";

/**
 * POST /api/assets/:id/archive
 *
 * Archiving has its own endpoint rather than being a field on PATCH, so it
 * cannot happen as a side effect of an unrelated edit. There is no DELETE:
 * an asset's valuation history is what makes past net worth correct, and
 * removing it would rewrite figures the household has already seen (G.4).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ asset: await archiveAsset(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
