import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { archiveCategory } from "@/features/categories/server/category-service";

/** POST /api/categories/:id/archive — categories are archived, never deleted. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ category: await archiveCategory(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
