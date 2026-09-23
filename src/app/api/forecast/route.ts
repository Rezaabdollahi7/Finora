import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError } from "@/lib/api";
import { FORECAST_PERIODS } from "@/features/forecast/forecast";
import { getForecast } from "@/features/forecast/server/forecast-service";

/** Only the four horizons the roadmap asks for (task 6.7). */
const querySchema = z.object({
  period: z.coerce
    .number()
    .int()
    .refine(
      (value): value is (typeof FORECAST_PERIODS)[number] =>
        (FORECAST_PERIODS as readonly number[]).includes(value),
      { message: "دوره پیش‌بینی نامعتبر است." },
    )
    .default(3),
});

/** GET /api/forecast?period= — projected liquidity, month by month. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { period } = querySchema.parse({
      period: params.get("period") ?? undefined,
    });

    return NextResponse.json({ forecast: await getForecast(period) });
  } catch (error) {
    return handleApiError(error);
  }
}
