import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { createMemberSchema } from "@/features/members/schemas";
import { createMember, listMembers } from "@/features/members/server/member-service";

/** GET /api/members — the household's people, in the order they were added. */
export async function GET() {
  try {
    return NextResponse.json({ members: await listMembers() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/members — add a person to the household. */
export async function POST(request: Request) {
  try {
    const input = createMemberSchema.parse(await readJsonBody(request));

    return NextResponse.json({ member: await createMember(input) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
