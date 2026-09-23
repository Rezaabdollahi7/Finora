import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { budgetMonthQuerySchema } from "@/features/budgets/schemas";
import { absoluteJalaliMonth, jalaliMonthOf } from "@/utils/date";
import { getBudgetHistory } from "@/features/budgets/server/budget-service";

/** GET /api/budgets/:categoryId/history — the last six months of a category. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { categoryId } = await params;
    const search = new URL(request.url).searchParams;
    const { month, owner } = budgetMonthQuerySchema.parse({
      month: search.get("month") ?? undefined,
      owner: search.get("owner") ?? undefined,
    });

    const end = month ?? absoluteJalaliMonth(jalaliMonthOf(new Date()));

    return NextResponse.json({
      history: await getBudgetHistory(categoryId, end, 6, owner),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
