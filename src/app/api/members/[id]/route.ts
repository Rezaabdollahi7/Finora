import { NextResponse } from "next/server";

import { handleApiError, readJsonBody } from "@/lib/api";
import { updateMemberSchema } from "@/features/members/schemas";
import { deleteMember, updateMember } from "@/features/members/server/member-service";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/members/:id — rename. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const input = updateMemberSchema.parse(await readJsonBody(request));

    return NextResponse.json({ member: await updateMember(id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/members/:id — only a member who owns nothing. */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deleteMember(id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
