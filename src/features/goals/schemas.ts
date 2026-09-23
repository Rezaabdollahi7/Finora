import { z } from "zod";

import { parseTomanToRial } from "@/utils/money";
import { OWNERS } from "@/features/accounts/types";
import { GOAL_KINDS, GOAL_STATUSES } from "@/features/goals/types";

/**
 * Validation for goal input.
 *
 * The single gate between untrusted input and the database, used by the API
 * routes and the forms alike so a rule cannot be enforced in one and
 * forgotten in the other.
 */

const MAX_NAME_LENGTH = 60;
const MAX_NOTES_LENGTH = 300;

/** A Toman amount the user typed, as positive Rial. */
const positiveAmount = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const rial = parseTomanToRial(String(value));

  if (rial === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مبلغ نامعتبر است." });
    return z.NEVER;
  }

  if (rial <= 0n) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "مبلغ باید بزرگ‌تر از صفر باشد.",
    });
    return z.NEVER;
  }

  return rial;
});

/** An ISO-8601 instant. Jalali input is converted before it gets here (G.5). */
const instant = z.union([z.string(), z.date()]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاریخ نامعتبر است." });
    return z.NEVER;
  }

  return date;
});

/** An optional instant. Blank or absent means "no deadline". */
const optionalInstant = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاریخ نامعتبر است." });
      return z.NEVER;
    }

    return date;
  });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} حداکثر ${max} نویسه است.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

const fields = {
  name: z
    .string()
    .trim()
    .min(1, "نام هدف را وارد کنید.")
    .max(MAX_NAME_LENGTH, `نام حداکثر ${MAX_NAME_LENGTH} نویسه است.`),
  kind: z.enum(GOAL_KINDS, { message: "نوع هدف را انتخاب کنید." }),
  targetAmount: positiveAmount,
  targetDate: optionalInstant,
  owner: z.enum(OWNERS, { message: "مالک را انتخاب کنید." }),
  icon: optionalText(40, "آیکون"),
  notes: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
};

export const createGoalSchema = z.object(fields);

/**
 * Update accepts any subset.
 *
 * `status` is absent: completing and archiving have their own endpoints so
 * neither can happen inside an unrelated edit, and so the intent is visible
 * in the request.
 */
export const updateGoalSchema = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

/**
 * Putting money aside, or taking it back out (task 6.4).
 *
 * A contribution is never a transaction: it earmarks money the household
 * already has rather than moving any. See the note on the model.
 */
export const createContributionSchema = z.object({
  amount: positiveAmount,
  date: instant,
  isWithdrawal: z.boolean().default(false),
  note: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
});

/** A query-string flag; see the note in features/accounts/schemas. */
const queryFlag = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((value) =>
    typeof value === "boolean"
      ? value
      : ["true", "1", "yes"].includes(value.toLowerCase()),
  );

export const goalFiltersSchema = z.object({
  owner: z.enum(OWNERS).optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  /** Archived goals are hidden unless explicitly asked for. */
  includeArchived: queryFlag,
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateContributionInput = z.infer<typeof createContributionSchema>;
export type GoalFilters = z.infer<typeof goalFiltersSchema>;
