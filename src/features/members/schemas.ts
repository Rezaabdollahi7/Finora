import { z } from "zod";

/** Long enough for a full name, short enough for a filter tab. */
export const MEMBER_NAME_MAX = 32;

const name = z
  .string({ message: "نام را وارد کنید." })
  .trim()
  .min(1, "نام را وارد کنید.")
  .max(
    MEMBER_NAME_MAX,
    `نام حداکثر ${MEMBER_NAME_MAX.toLocaleString("fa-IR")} حرف است.`,
  );

export const createMemberSchema = z.object({ name });
export const updateMemberSchema = z.object({ name });

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/**
 * An owner as it arrives in a request: `"SHARED"` or a member id.
 *
 * Only the shape is checked here. Whether the member exists is a database
 * question, answered by `assertOwner` in the services that write records.
 */
export const ownerSchema = (message = "مالک را انتخاب کنید.") =>
  z.string({ message }).trim().min(1, message).max(64, message);
