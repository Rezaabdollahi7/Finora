import { z } from "zod";

import { parseTomanToRial } from "@/utils/money";
import { OWNERS } from "@/features/accounts/types";
import { TRANSACTION_TYPES } from "@/features/transactions/types";

/**
 * Validation for transaction input, shared by the API and (from 1.9) the
 * forms, so a rule cannot be enforced in one and forgotten in the other.
 */

const MAX_DESCRIPTION_LENGTH = 200;

/**
 * An amount the user typed, in Toman, as positive Rial.
 *
 * Positive is a hard requirement, not a convention: the direction of a
 * movement lives in `type` (rule G.2), and the database enforces the same
 * thing with a CHECK constraint.
 */
export const positiveTomanAmount = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
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

/** An ISO-8601 instant. Jalali input is converted before it reaches here (rule G.5). */
const instant = z.union([z.string(), z.date()]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاریخ نامعتبر است." });
    return z.NEVER;
  }

  return date;
});

const descriptionSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH, `توضیح حداکثر ${MAX_DESCRIPTION_LENGTH} نویسه است.`)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

const baseFields = {
  amount: positiveTomanAmount,
  accountId: z.string().min(1, "حساب را انتخاب کنید."),
  owner: z.enum(OWNERS, { message: "مالک تراکنش را انتخاب کنید." }),
  description: descriptionSchema,
  date: instant,
  /** The Category model arrives in 1.7; nothing sets this yet. */
  categoryId: z.string().min(1).nullable().default(null),
};

/**
 * The shape rules the database also enforces, checked here so the user gets
 * a field-level message instead of a constraint violation.
 */
function refineShape<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value: z.infer<T>, ctx) => {
    if (value.type === "TRANSFER") {
      if (!value.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "حساب مقصد را انتخاب کنید.",
        });
      } else if (value.toAccountId === value.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toAccountId"],
          message: "حساب مبدأ و مقصد نمی‌توانند یکی باشند.",
        });
      }

      if (value.categoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categoryId"],
          message: "انتقال بین حساب‌ها دسته‌بندی ندارد.",
        });
      }
    } else if (value.toAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toAccountId"],
        message: "فقط انتقال، حساب مقصد دارد.",
      });
    }
  });
}

export const createTransactionSchema = refineShape(
  z.object({
    ...baseFields,
    type: z.enum(TRANSACTION_TYPES, { message: "نوع تراکنش را انتخاب کنید." }),
    toAccountId: z.string().min(1).nullable().default(null),
  }),
);

/**
 * Update replaces the whole transaction.
 *
 * A partial update would let a type change without its destination changing
 * with it — an expense edited into a transfer with no destination, say — and
 * every such combination would need its own rule. Replacing the record keeps
 * one set of invariants and one code path.
 */
export const updateTransactionSchema = createTransactionSchema;

/** An optional amount bound, in Toman, as Rial. Blank means "no bound". */
const optionalTomanBound = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || String(value).trim() === "") return undefined;

    const rial = parseTomanToRial(String(value));

    if (rial === null || rial < 0n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مبلغ نامعتبر است." });
      return z.NEVER;
    }

    return rial;
  });

/** An optional instant bound. Blank means "no bound". */
const optionalInstant = z
  .union([z.string(), z.date()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || (typeof value === "string" && value.trim() === "")) {
      return undefined;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تاریخ نامعتبر است." });
      return z.NEVER;
    }

    return date;
  });

/**
 * The full filter set (task 1.8).
 *
 * Both range filters are inclusive on each end, which is what a user means by
 * "from the 1st to the 31st". Reversed ranges are rejected rather than
 * quietly returning nothing, so a mistyped bound is visible instead of
 * looking like an empty ledger.
 *
 * `categoryId` accepts the sentinel "none" to mean "uncategorised", which a
 * plain id cannot express and which is the one filter that finds entries
 * needing attention.
 */
export const UNCATEGORISED = "none";

export const transactionFiltersSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES).optional(),
    accountId: z.string().min(1).optional(),
    owner: z.enum(OWNERS).optional(),
    categoryId: z.string().min(1).optional(),
    dateFrom: optionalInstant,
    dateTo: optionalInstant,
    amountMin: optionalTomanBound,
    amountMax: optionalTomanBound,
    /** Free-text match against the description. */
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.",
      });
    }

    if (
      value.amountMin !== undefined &&
      value.amountMax !== undefined &&
      value.amountMin > value.amountMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountMax"],
        message: "حداکثر مبلغ نمی‌تواند کمتر از حداقل باشد.",
      });
    }
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
