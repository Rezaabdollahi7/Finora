import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import {
  categoryFiltersSchema,
  createCategorySchema,
} from "@/features/categories/schemas";
import {
  createCategory,
  listCategoryTree,
} from "@/features/categories/server/category-service";

/** GET /api/categories — the category tree, one level deep. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = categoryFiltersSchema.parse({
      kind: params.get("kind") ?? undefined,
      includeArchived: params.get("includeArchived") ?? undefined,
    });

    return NextResponse.json({ categories: await listCategoryTree(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/categories — create a category or a subcategory. */
export async function POST(request: Request) {
  try {
    const input = createCategorySchema.parse(await readJsonBody(request));

    return NextResponse.json(
      { category: await createCategory(input) },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
