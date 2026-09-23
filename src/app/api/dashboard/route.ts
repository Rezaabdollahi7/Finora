import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { jalaliMonthOf } from "@/utils/date";
import { periodSchema } from "@/features/dashboard/schemas";
import {
  getCashFlow,
  getDashboardSummary,
  getExpensesByCategory,
} from "@/features/dashboard/server/dashboard-service";

/**
 * GET /api/dashboard — every figure the dashboard shows, in one request.
 *
 * One endpoint rather than nine: the page needs all of it at once, and the
 * summary already reads the same tables the charts do.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = periodSchema.parse({
      year: params.get("year") ?? undefined,
      month: params.get("month") ?? undefined,
    });

    const now = jalaliMonthOf(new Date());
    const month = {
      year: input.year ?? now.year,
      month: input.month ?? now.month,
    };

    const [summary, cashFlow, expensesByCategory] = await Promise.all([
      getDashboardSummary(month),
      getCashFlow(6, month),
      getExpensesByCategory(month),
    ]);

    return NextResponse.json({ ...summary, cashFlow, expensesByCategory });
  } catch (error) {
    return handleApiError(error);
  }
}
