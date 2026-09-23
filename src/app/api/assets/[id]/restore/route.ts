import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { restoreAsset } from "@/features/assets/server/asset-service";

/** POST /api/assets/:id/restore — bring an archived asset back. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ asset: await restoreAsset(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
