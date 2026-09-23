import { z } from "zod";

import { parseTomanToRial } from "@/utils/money";
import { OWNERS } from "@/features/accounts/types";

/**
 * Validation for budget input.
 *
 * The single gate between untrusted input and the database, used by the API
 * routes and the forms alike so a rule cannot be enforced in one and
 * forgotten in the other.
 */

/** A Toman amount the user typed, as non-negative Rial. */
const budgetAmount = z.union([z.string(), z.number()]).transform((value, ctx) => {
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

/**
 * A Jalali month as the absolute integer `absoluteJalaliMonth` produces.
 *
 * The bounds are Jalali years 1300 and 1500 — wide enough for any real
 * household and narrow enough that a stray `Date.now()` or a year typed as
 * Gregorian is rejected rather than stored.
 */
const absoluteMonth = z.coerce
  .number()
  .int("ماه نامعتبر است.")
  .min(1300 * 12, "ماه نامعتبر است.")
  .max(1500 * 12, "ماه نامعتبر است.");

/**
 * Whose spending a budget measures (task 7.5).
 *
 * Defaults to the household. A personal budget is the same shape scoped to
 * one person, which is what keeps a gadget someone bought for themselves out
 * of the household's food budget.
 */
const budgetOwner = z.enum(OWNERS).default("SHARED");

export const setBudgetSchema = z.object({
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید."),
  owner: budgetOwner,
  amount: budgetAmount,
  /** The month the new limit starts applying to. Earlier months keep theirs. */
  fromMonth: absoluteMonth,
  rollover: z.boolean().default(false),
});

/** Clearing a budget: it stops applying from this month on. */
export const clearBudgetSchema = z.object({
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید."),
  owner: budgetOwner,
  fromMonth: absoluteMonth,
});

export const budgetMonthQuerySchema = z.object({
  month: absoluteMonth.optional(),
  owner: budgetOwner,
});

export type SetBudgetInput = z.infer<typeof setBudgetSchema>;
export type ClearBudgetInput = z.infer<typeof clearBudgetSchema>;
export type BudgetMonthQuery = z.infer<typeof budgetMonthQuerySchema>;
