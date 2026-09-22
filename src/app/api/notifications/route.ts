import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/api";
import { getNotifications } from "@/features/notifications/server/notification-service";

/**
 * GET /api/notifications — everything the household should be told (8.11).
 *
 * Derived on every read, never stored: most of these change with nothing but
 * the passage of time, so a cached copy would be wrong by morning.
 */
export async function GET() {
  try {
    return NextResponse.json(await getNotifications());
  } catch (error) {
    return handleApiError(error);
  }
}
