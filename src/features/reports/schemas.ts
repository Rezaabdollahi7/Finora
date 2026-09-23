import { z } from "zod";

import { OWNERS } from "@/features/accounts/types";

/**
 * Report filters (task 8.9).
 *
 * Every report takes the same four, so a household can move between them
 * without re-stating what it is looking at. The range is inclusive of both
 * ends in Jalali months, which is how a person says "from Farvardin to
 * Shahrivar".
 */

const absoluteMonth = z.coerce
  .number()
  .int("ماه نامعتبر است.")
  .min(1300 * 12, "ماه نامعتبر است.")
  .max(1500 * 12, "ماه نامعتبر است.");

/** How many months a report may span. Two Jalali years is already a lot. */
export const MAX_REPORT_MONTHS = 24;

export const reportFiltersSchema = z
  .object({
    /** First Jalali month, inclusive. Defaults to five months back. */
    fromMonth: absoluteMonth.optional(),
    /** Last Jalali month, inclusive. Defaults to the current one. */
    toMonth: absoluteMonth.optional(),
    owner: z.enum(OWNERS).optional(),
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.fromMonth !== undefined &&
      value.toMonth !== undefined &&
      value.fromMonth > value.toMonth
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fromMonth"],
        message: "شروع بازه نمی‌تواند بعد از پایان آن باشد.",
      });
    }

    if (
      value.fromMonth !== undefined &&
      value.toMonth !== undefined &&
      value.toMonth - value.fromMonth + 1 > MAX_REPORT_MONTHS
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toMonth"],
        message: `بازه گزارش حداکثر ${MAX_REPORT_MONTHS} ماه است.`,
      });
    }
  });

export type ReportFilters = z.infer<typeof reportFiltersSchema>;
