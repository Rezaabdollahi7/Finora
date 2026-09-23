import { NextResponse } from "next/server";

import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateCategorySchema } from "@/features/categories/schemas";
import {
  getCategory,
  updateCategory,
} from "@/features/categories/server/category-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const category = await getCategory(id);

    if (!category) return apiError("دسته پیدا نشد.", "NOT_FOUND", 404);

    return NextResponse.json({ category });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/categories/:id
 *
 * Only the presentation fields. Kind and parent are immutable: changing
 * either would reclassify every transaction already filed under the category
 * (rule G.4).
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateCategorySchema.parse(await readJsonBody(request));

    return NextResponse.json({ category: await updateCategory(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
