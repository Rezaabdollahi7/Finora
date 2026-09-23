import { z } from "zod";

import { parseTomanToRial } from "@/utils/money";
import { OWNERS } from "@/features/accounts/types";
import { RECURRENCE_FREQUENCIES } from "@/features/recurring/recurrence";

/**
 * Validation for recurring payment input.
 *
 * The single gate between untrusted input and the database, used by the API
 * routes and the forms alike so a rule cannot be enforced in one and
 * forgotten in the other.
 */

const MAX_NAME_LENGTH = 60;
const MAX_NOTES_LENGTH = 300;
/** Beyond this an interval is a typo rather than a cadence. */
const MAX_INTERVAL = 365;

/** A Toman amount the user typed, as positive Rial. */
const paymentAmount = z.union([z.string(), z.number()]).transform((value, ctx) => {
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

/** An optional instant. Blank or absent means "no end". */
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
    .min(1, "نام پرداخت را وارد کنید.")
    .max(MAX_NAME_LENGTH, `نام حداکثر ${MAX_NAME_LENGTH} نویسه است.`),
  amount: paymentAmount,
  frequency: z.enum(RECURRENCE_FREQUENCIES, { message: "دوره را انتخاب کنید." }),
  interval: z.coerce
    .number()
    .int("فاصله باید عدد صحیح باشد.")
    .min(1, "فاصله باید حداقل ۱ باشد.")
    .max(MAX_INTERVAL, `فاصله حداکثر ${MAX_INTERVAL} است.`)
    .default(1),
  startDate: instant,
  endDate: optionalInstant,
  /**
   * Only MONTHLY reads this. The other frequencies take their day from the
   * start date, so sending one is accepted and ignored rather than rejected
   * — a form that keeps the field mounted while the user switches frequency
   * should not fail validation for it.
   */
  paymentDay: z.coerce
    .number()
    .int()
    .min(1, "روز پرداخت باید بین ۱ تا ۳۱ باشد.")
    .max(31, "روز پرداخت باید بین ۱ تا ۳۱ باشد.")
    .nullable()
    .default(null),
  categoryId: z.string().min(1).nullable().default(null),
  accountId: z.string().min(1).nullable().default(null),
  owner: z.enum(OWNERS, { message: "مالک را انتخاب کنید." }),
  notes: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
};

/** A rule that ends before it starts produces nothing and means nothing. */
function refineWindow<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: z.infer<T>, ctx) => {
    if (value.endDate && value.startDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.",
      });
    }
  });
}

export const createRecurringPaymentSchema = refineWindow(z.object(fields));

/**
 * Update accepts any subset.
 *
 * `isActive` is absent: switching a rule off has its own endpoint so it
 * cannot happen inside an unrelated edit, and so the intent is visible in
 * the request.
 */
export const updateRecurringPaymentSchema = refineWindow(
  z
    .object(fields)
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "هیچ تغییری ارسال نشده است.",
    }),
);

/**
 * Paying one expected occurrence (task 5.4).
 *
 * The amount is optional and defaults to the rule's: a utility bill is
 * "about" a figure, and the month it is not is exactly the month worth
 * recording faithfully rather than rounding to the rule.
 */
export const payOccurrenceSchema = z.object({
  /** Which expected occurrence, by the date the rule produced. */
  dueDate: instant,
  amount: paymentAmount.optional(),
  accountId: z.string().min(1).optional(),
  /** When the money left. Defaults to the due date. */
  paidAt: optionalInstant,
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

export const recurringFiltersSchema = z.object({
  owner: z.enum(OWNERS).optional(),
  /** Inactive rules are hidden unless explicitly asked for. */
  includeInactive: queryFlag,
});

export type CreateRecurringPaymentInput = z.infer<typeof createRecurringPaymentSchema>;
export type UpdateRecurringPaymentInput = z.infer<typeof updateRecurringPaymentSchema>;
export type PayOccurrenceInput = z.infer<typeof payOccurrenceSchema>;
export type RecurringFilters = z.infer<typeof recurringFiltersSchema>;
