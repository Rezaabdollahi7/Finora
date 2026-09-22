import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { reportFiltersSchema } from "@/features/reports/schemas";
import { getReports } from "@/features/reports/server/report-service";

/** GET /api/reports — every report for one range, with the shared filters. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = reportFiltersSchema.parse({
      fromMonth: params.get("from") ?? undefined,
      toMonth: params.get("to") ?? undefined,
      owner: params.get("owner") ?? undefined,
      accountId: params.get("accountId") ?? undefined,
      categoryId: params.get("categoryId") ?? undefined,
    });

    return NextResponse.json({ reports: await getReports(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}
