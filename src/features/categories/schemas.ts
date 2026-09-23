import { z } from "zod";

import { CATEGORY_ICON_KEYS } from "@/features/categories/icons";
import { CATEGORY_KINDS } from "@/features/categories/types";

const nameSchema = z
  .string()
  .trim()
  .min(1, "نام دسته را وارد کنید.")
  .max(40, "نام دسته حداکثر ۴۰ نویسه است.");

export const createCategorySchema = z.object({
  name: nameSchema,
  kind: z.enum(CATEGORY_KINDS, { message: "نوع دسته را انتخاب کنید." }),
  /** Null creates a top-level category. */
  parentId: z.string().min(1).nullable().default(null),
  icon: z.enum(CATEGORY_ICON_KEYS).nullable().default(null),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

/**
 * `kind` is not editable.
 *
 * Moving a category from expense to income would silently reclassify every
 * transaction already filed under it, turning spending into earnings in every
 * report (rule G.4). The same applies to reparenting, which could also change
 * the kind through the parent — so the parent is fixed too. Make a new
 * category and archive the old one.
 */
export const updateCategorySchema = z
  .object({
    name: nameSchema,
    icon: z.enum(CATEGORY_ICON_KEYS).nullable(),
    sortOrder: z.coerce.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

export const categoryFiltersSchema = z.object({
  kind: z.enum(CATEGORY_KINDS).optional(),
  includeArchived: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((value) =>
      typeof value === "boolean"
        ? value
        : ["true", "1", "yes"].includes(value.toLowerCase()),
    ),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryFilters = z.infer<typeof categoryFiltersSchema>;
