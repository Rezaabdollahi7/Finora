import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import {
  budgetMonthQuerySchema,
  clearBudgetSchema,
  setBudgetSchema,
} from "@/features/budgets/schemas";
import {
  clearBudget,
  getBudgetMonth,
  setBudget,
} from "@/features/budgets/server/budget-service";

/** GET /api/budgets?month=&owner= — one month of budgets, spending and alerts. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { month, owner } = budgetMonthQuerySchema.parse({
      month: params.get("month") ?? undefined,
      owner: params.get("owner") ?? undefined,
    });

    return NextResponse.json({
      budget: await getBudgetMonth(month, new Date(), owner),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/budgets — set a category's limit from a month on.
 *
 * PUT rather than POST: setting the same category and month twice is the
 * same budget, not a second one. The months before keep their own figures
 * (rule G.4).
 */
export async function PUT(request: Request) {
  try {
    const input = setBudgetSchema.parse(await readJsonBody(request));
    await setBudget(input);

    return NextResponse.json({
      budget: await getBudgetMonth(input.fromMonth, new Date(), input.owner),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/budgets?categoryId=&fromMonth= — stop budgeting from a month on.
 *
 * The months it did apply to keep their figures, so an earlier report still
 * shows what that month was measured against.
 */
export async function DELETE(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = clearBudgetSchema.parse({
      categoryId: params.get("categoryId") ?? "",
      fromMonth: params.get("fromMonth") ?? undefined,
    });

    await clearBudget(input);

    return NextResponse.json({
      budget: await getBudgetMonth(input.fromMonth, new Date(), input.owner),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
