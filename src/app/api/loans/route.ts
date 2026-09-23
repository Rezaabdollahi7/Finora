import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { createLoanSchema, loanFiltersSchema } from "@/features/loans/schemas";
import { createLoan, listLoans } from "@/features/loans/server/loan-service";

/** GET /api/loans — list loans, optionally filtered. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const filters = loanFiltersSchema.parse({
      owner: params.get("owner") ?? undefined,
      status: params.get("status") ?? undefined,
      includeArchived: params.get("includeArchived") ?? undefined,
    });

    return NextResponse.json({ loans: await listLoans(filters) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/loans — create a loan and generate its whole schedule. */
export async function POST(request: Request) {
  try {
    const input = createLoanSchema.parse(await readJsonBody(request));
    const loan = await createLoan(input);

    return NextResponse.json({ loan }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
