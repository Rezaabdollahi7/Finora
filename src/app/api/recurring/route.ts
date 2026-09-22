import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import {
  createRecurringPaymentSchema,
  recurringFiltersSchema,
} from "@/features/recurring/schemas";
import {
  createRecurringPayment,
  listRecurringPayments,
} from "@/features/recurring/server/recurring-service";

/** GET /api/recurring — the rules, optionally including inactive ones. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = recurringFiltersSchema.parse({
      owner: params.get("owner") ?? undefined,
      includeInactive: params.get("includeInactive") ?? undefined,
    });

    return NextResponse.json({ payments: await listRecurringPayments(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/recurring — add a rule. Its occurrences are derived, not written. */
export async function POST(request: Request) {
  try {
    const input = createRecurringPaymentSchema.parse(await readJsonBody(request));
    const payment = await createRecurringPayment(input);

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
