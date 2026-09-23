import { z } from "zod";

/**
 * A Jalali month, as a query parameter.
 *
 * Both parts are optional and default to the current month, so `/api/dashboard`
 * with no arguments answers "how are our finances right now?".
 */
export const periodSchema = z.object({
  year: z.coerce.number().int().min(1300).max(1500).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const cashFlowSchema = periodSchema.extend({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

export type PeriodInput = z.infer<typeof periodSchema>;
export type CashFlowInput = z.infer<typeof cashFlowSchema>;
