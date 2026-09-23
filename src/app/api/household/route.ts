import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError } from "@/lib/api";
import { getHouseholdMonth } from "@/features/household/server/household-service";

/** The same bounds the budget month uses; see features/budgets/schemas. */
const querySchema = z.object({
  month: z.coerce
    .number()
    .int("ماه نامعتبر است.")
    .min(1300 * 12, "ماه نامعتبر است.")
    .max(1500 * 12, "ماه نامعتبر است.")
    .optional(),
});

/** GET /api/household?month= — one Jalali month of the household. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { month } = querySchema.parse({
      month: params.get("month") ?? undefined,
    });

    return NextResponse.json({ household: await getHouseholdMonth(month) });
  } catch (error) {
    return handleApiError(error);
  }
}
