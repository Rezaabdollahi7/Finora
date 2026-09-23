import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { restoreCategory } from "@/features/categories/server/category-service";

/** POST /api/categories/:id/restore — categories are archived, never deleted. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ category: await restoreCategory(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
