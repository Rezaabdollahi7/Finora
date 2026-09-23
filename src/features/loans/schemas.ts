import { z } from "zod";

import { parseNumber } from "@/utils/number";
import { parseTomanToRial } from "@/utils/money";
import { ownerSchema } from "@/features/members/schemas";
import { MAX_PAYMENT_DAY } from "@/features/loans/schedule";
import { LOAN_STATUSES } from "@/features/loans/types";

/**
 * Validation for loan input.
 *
 * The single gate between untrusted input and the database, used by the API
 * routes and the forms alike so a rule cannot be enforced in one and
 * forgotten in the other.
 */

const MAX_NAME_LENGTH = 60;
const MAX_NOTES_LENGTH = 300;
/** Ten Jalali years of monthly payments. Longer is a data-entry slip. */
const MAX_INSTALLMENTS = 480;
/** 100% a year, in basis points. Above this is a typo, not a loan. */
const MAX_RATE_BASIS_POINTS = 10_000;

/** A Toman amount the user typed, as non-negative Rial. */
const loanAmount = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const rial = parseTomanToRial(String(value));

  if (rial === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مبلغ نامعتبر است." });
    return z.NEVER;
  }

  if (rial < 0n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مبلغ نمی‌تواند منفی باشد." });
    return z.NEVER;
  }

  return rial;
});

/** The monthly instalment, which has to be more than nothing. */
const installmentAmount = loanAmount.refine((rial) => rial > 0n, {
  message: "مبلغ قسط باید بزرگ‌تر از صفر باشد.",
});

/**
 * An annual rate the user typed as a percentage, as integer basis points.
 *
 * "23.5" becomes 2350. Stored as an integer for the same reason money is:
 * the rate is multiplied by money to show what a loan costs, and the float
 * would put that figure a Rial out.
 */
export const interestRate = z
  .union([z.string(), z.number()])
  .default(0)
  .transform((value, ctx) => {
    const text = String(value).trim();
    if (text === "") return 0;

    const percent = parseNumber(text);

    if (percent === null || percent < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "نرخ سود نامعتبر است." });
      return z.NEVER;
    }

    const basisPoints = Math.round(percent * 100);

    if (basisPoints > MAX_RATE_BASIS_POINTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "نرخ سود نمی‌تواند بیشتر از ۱۰۰ درصد باشد.",
      });
      return z.NEVER;
    }

    return basisPoints;
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

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} حداکثر ${max} نویسه است.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

export const loanNameSchema = z
  .string()
  .trim()
  .min(1, "نام وام را وارد کنید.")
  .max(MAX_NAME_LENGTH, `نام وام حداکثر ${MAX_NAME_LENGTH} نویسه است.`);

/** Fields that describe the loan without touching its schedule. */
const descriptiveFields = {
  name: loanNameSchema,
  provider: z
    .string()
    .trim()
    .min(1, "نام بانک یا وام‌دهنده را وارد کنید.")
    .max(MAX_NAME_LENGTH, `نام وام‌دهنده حداکثر ${MAX_NAME_LENGTH} نویسه است.`),
  owner: ownerSchema("مالک وام را انتخاب کنید."),
  categoryId: z.string().min(1).nullable().default(null),
  accountId: z.string().min(1).nullable().default(null),
  notes: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
};

/**
 * Fields the schedule is built from.
 *
 * Changing any of them regenerates the unpaid instalments, which is why they
 * are named as a group: the service has to treat them together.
 */
const scheduleFields = {
  principalAmount: loanAmount,
  interestRate,
  installmentAmount,
  installmentCount: z.coerce
    .number()
    .int("تعداد اقساط باید عدد صحیح باشد.")
    .min(1, "تعداد اقساط باید حداقل ۱ باشد.")
    .max(MAX_INSTALLMENTS, `تعداد اقساط حداکثر ${MAX_INSTALLMENTS} است.`),
  startDate: instant,
  paymentDay: z.coerce
    .number()
    .int("روز پرداخت باید عدد صحیح باشد.")
    .min(1, "روز پرداخت باید بین ۱ تا ۳۱ باشد.")
    .max(MAX_PAYMENT_DAY, "روز پرداخت باید بین ۱ تا ۳۱ باشد."),
};

export const createLoanSchema = z.object({ ...descriptiveFields, ...scheduleFields });

/**
 * Update accepts any subset.
 *
 * `status` is absent: archiving and settling have their own paths so neither
 * can happen as a side effect of an unrelated edit, and so a loan cannot be
 * marked settled while instalments are still owed.
 */
export const updateLoanSchema = z
  .object({ ...descriptiveFields, ...scheduleFields })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

/**
 * Paying an instalment (task 4.4).
 *
 * The account is optional here and falls back to the loan's own account; the
 * service rejects the case where neither is set, because an expense has to
 * come out of somewhere.
 */
export const payInstallmentSchema = z.object({
  accountId: z.string().min(1).optional(),
  /** When the money left. Defaults to now. */
  paidAt: instant.optional(),
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

export const loanFiltersSchema = z.object({
  owner: ownerSchema().optional(),
  status: z.enum(LOAN_STATUSES).optional(),
  /** Archived loans are hidden unless explicitly asked for. */
  includeArchived: queryFlag,
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type PayInstallmentInput = z.infer<typeof payInstallmentSchema>;
export type LoanFilters = z.infer<typeof loanFiltersSchema>;

/** The names of the fields that force the schedule to be regenerated. */
export const SCHEDULE_FIELDS = [
  "installmentAmount",
  "installmentCount",
  "startDate",
  "paymentDay",
] as const satisfies readonly (keyof UpdateLoanInput)[];
