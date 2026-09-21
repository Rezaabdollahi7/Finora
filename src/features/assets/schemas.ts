import { z } from "zod";

import { parseTomanToRial } from "@/utils/money";
import { ONE_QUANTITY, parseQuantity } from "@/utils/quantity";
import { OWNERS } from "@/features/accounts/types";
import { ASSET_TYPES } from "@/features/assets/types";

/**
 * Validation for asset input.
 *
 * The single gate between untrusted input and the database, used by the API
 * routes and the forms alike so a rule cannot be enforced in one and
 * forgotten in the other. The domain rules that depend on the asset's type —
 * forcing a fixed asset to a quantity of one, defaulting a unit — live in the
 * service, which is the layer that owns them.
 */

const MAX_NAME_LENGTH = 60;
const MAX_UNIT_LENGTH = 16;
const MAX_NOTES_LENGTH = 300;

/** A price the user typed in Toman, as non-negative Rial. */
export const assetPrice = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const rial = parseTomanToRial(String(value));

  if (rial === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مبلغ نامعتبر است." });
    return z.NEVER;
  }

  if (rial < 0n) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "مبلغ نمی‌تواند منفی باشد.",
    });
    return z.NEVER;
  }

  return rial;
});

/**
 * A holding the user typed, as a 10^8-scaled `bigint`.
 *
 * Zero is rejected along with negatives: an asset you hold none of is not an
 * asset, and it would silently contribute nothing to a portfolio that still
 * listed it.
 */
export const assetQuantity = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const quantity = parseQuantity(String(value));

    if (quantity === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مقدار نامعتبر است." });
      return z.NEVER;
    }

    if (quantity <= 0n) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "مقدار باید بزرگ‌تر از صفر باشد.",
      });
      return z.NEVER;
    }

    return quantity;
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

export const assetNameSchema = z
  .string()
  .trim()
  .min(1, "نام دارایی را وارد کنید.")
  .max(MAX_NAME_LENGTH, `نام دارایی حداکثر ${MAX_NAME_LENGTH} نویسه است.`);

export const createAssetSchema = z.object({
  name: assetNameSchema,
  type: z.enum(ASSET_TYPES, { message: "نوع دارایی را انتخاب کنید." }),
  owner: z.enum(OWNERS, { message: "مالک دارایی را انتخاب کنید." }),
  /** Ignored for fixed-value assets, which are always exactly one. */
  quantity: assetQuantity.default(String(ONE_QUANTITY / 100_000_000n)),
  unit: optionalText(MAX_UNIT_LENGTH, "واحد"),
  purchaseUnitPrice: assetPrice,
  purchaseDate: instant,
  /**
   * What one unit is worth today, if it already differs from what was paid.
   *
   * Omitting it is the common case and the honest default: an asset added
   * today is worth what it cost, and inventing a current price would show a
   * profit nobody made.
   */
  currentUnitPrice: assetPrice.optional(),
  notes: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
});

/**
 * Update accepts any subset of the editable fields.
 *
 * `type` is absent on purpose. Changing a car into a gold holding would
 * change which side of the quantity/fixed split it sits on, and every
 * valuation already recorded against it was taken in the old shape — task
 * 3.8's guarantee would not survive it. Archiving the asset and adding the
 * right one keeps the history truthful.
 *
 * `isActive` is absent for the same reason it is on accounts: archiving has
 * its own endpoint so it cannot happen inside an unrelated edit.
 */
export const updateAssetSchema = z
  .object({
    name: assetNameSchema,
    owner: z.enum(OWNERS),
    quantity: assetQuantity,
    unit: optionalText(MAX_UNIT_LENGTH, "واحد"),
    purchaseUnitPrice: assetPrice,
    purchaseDate: instant,
    notes: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

/**
 * Recording what an asset is worth now (task 3.8).
 *
 * `asOf` defaults to the moment of the request rather than being required:
 * the overwhelmingly common action is "this is today's price", and making the
 * user restate today invites a typo that back-dates a price into history.
 */
export const recordValuationSchema = z.object({
  unitPrice: assetPrice,
  asOf: instant.optional(),
  note: optionalText(MAX_NOTES_LENGTH, "یادداشت"),
});

/**
 * A query-string flag.
 *
 * Not `z.coerce.boolean()`: that is `Boolean(value)`, so "false" coerces to
 * true and `?includeArchived=false` would do the opposite of what it says.
 */
const queryFlag = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((value) =>
    typeof value === "boolean"
      ? value
      : ["true", "1", "yes"].includes(value.toLowerCase()),
  );

export const assetFiltersSchema = z.object({
  owner: z.enum(OWNERS).optional(),
  type: z.enum(ASSET_TYPES).optional(),
  /** Archived assets are hidden unless explicitly asked for. */
  includeArchived: queryFlag,
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type RecordValuationInput = z.infer<typeof recordValuationSchema>;
export type AssetFilters = z.infer<typeof assetFiltersSchema>;
