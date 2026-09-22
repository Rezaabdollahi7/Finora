import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError } from "@/lib/api";
import { getCalendarMonth } from "@/features/calendar/server/calendar-service";

const monthSchema = z.object({
  year: z.coerce.number().int().min(1300).max(1500),
  month: z.coerce.number().int().min(1).max(12),
});

/**
 * GET /api/calendar?year=1405&month=6
 *
 * One Jalali month of obligations. Stepping the calendar fetches this rather
 * than reloading the page; paging through months is something people do
 * quickly.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const month = monthSchema.parse({
      year: params.get("year"),
      month: params.get("month"),
    });

    return NextResponse.json({ month: await getCalendarMonth(month) });
  } catch (error) {
    return handleApiError(error);
  }
}
