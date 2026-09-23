import { z } from "zod";

import { parseTomanToRial } from "@/utils/money";
import { ACCOUNT_TYPES, SUPPORTED_CURRENCIES } from "@/features/accounts/types";
import { ownerSchema } from "@/features/members/schemas";

/**
 * Validation for account input.
 *
 * These schemas are the single gate between untrusted input and the database:
 * the API route handlers and the forms both use them, so a rule cannot be
 * enforced in one place and forgotten in the other.
 */

const MAX_NAME_LENGTH = 60;

/**
 * An amount the user typed, in Toman, converted to a Rial `bigint`.
 *
 * Accepts a number only for convenience at the API boundary; it is stringified
 * before parsing so the value never passes through floating-point arithmetic
 * (rule G.2).
 */
export const tomanAmount = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const rial = parseTomanToRial(String(value));

  if (rial === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مبلغ نامعتبر است." });
    return z.NEVER;
  }

  return rial;
});

export const accountNameSchema = z
  .string()
  .trim()
  .min(1, "نام حساب را وارد کنید.")
  .max(MAX_NAME_LENGTH, `نام حساب حداکثر ${MAX_NAME_LENGTH} نویسه است.`);

export const createAccountSchema = z.object({
  name: accountNameSchema,
  type: z.enum(ACCOUNT_TYPES, { message: "نوع حساب را انتخاب کنید." }),
  owner: ownerSchema("مالک حساب را انتخاب کنید."),
  currency: z.enum(SUPPORTED_CURRENCIES).default("IRR"),
  // The default is the *input* "0", which the transform turns into 0n.
  initialBalance: tomanAmount.default("0"),
});

/**
 * Update accepts any subset of the editable fields.
 *
 * `isActive` is deliberately absent: archiving goes through its own endpoint
 * so it cannot happen by accident inside an unrelated edit, and so the
 * intent is visible in the request itself.
 */
export const updateAccountSchema = z
  .object({
    name: accountNameSchema,
    type: z.enum(ACCOUNT_TYPES),
    owner: ownerSchema(),
    currency: z.enum(SUPPORTED_CURRENCIES),
    initialBalance: tomanAmount,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

/**
 * A query-string flag.
 *
 * Not `z.coerce.boolean()`: that is `Boolean(value)`, so the string "false"
 * coerces to true and `?includeArchived=false` would do the opposite of what
 * it says.
 */
const queryFlag = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((value) =>
    typeof value === "boolean"
      ? value
      : ["true", "1", "yes"].includes(value.toLowerCase()),
  );

export const accountFiltersSchema = z.object({
  owner: ownerSchema().optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  /** Archived accounts are hidden unless explicitly asked for. */
  includeArchived: queryFlag,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountFilters = z.infer<typeof accountFiltersSchema>;
