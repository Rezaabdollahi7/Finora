import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError } from "@/lib/api";
import { getNetWorthHistory } from "@/features/dashboard/server/dashboard-service";
import { NET_WORTH_RANGES } from "@/features/dashboard/types";

const querySchema = z.object({
  range: z.enum(NET_WORTH_RANGES).default("M6"),
});

/**
 * GET /api/dashboard/net-worth — the net-worth series for one range.
 *
 * Separate from the dashboard endpoint because the range selector refetches
 * on its own, and re-running every other aggregate to redraw one line would
 * be wasteful.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const { range } = querySchema.parse({ range: params.get("range") ?? undefined });

    return NextResponse.json({ range, points: await getNetWorthHistory(range) });
  } catch (error) {
    return handleApiError(error);
  }
}
