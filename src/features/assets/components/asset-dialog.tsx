"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import {
  JalaliDateField,
  readJalaliFields,
  toJalaliFields,
  todayJalaliFields,
} from "@/components/common/jalali-date-field";
import { formatToman, parseTomanToRial } from "@/utils/money";
import { formatQuantity, parseQuantity } from "@/utils/quantity";
import { type Owner } from "@/features/accounts/types";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  DEFAULT_ASSET_UNIT,
  isQuantityAsset,
  type AssetDto,
  type AssetType,
} from "@/features/assets/types";
import { useOwners } from "@/features/members/components/members-provider";
import { DATE_NOTE, FormNotes } from "@/components/common/form-notes";

type FormValues = {
  name: string;
  type: AssetType | "";
  owner: Owner | "";
  /** As typed. Converted to the scaled integer by the API's schema. */
  quantity: string;
  unit: string;
  /** Toman, as typed. */
  purchaseUnitPrice: string;
  currentUnitPrice: string;
  notes: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

function defaultsFor(asset: AssetDto | undefined): FormValues {
  const jalali = asset
    ? toJalaliFields(new Date(asset.purchaseDate))
    : todayJalaliFields();

  return {
    name: asset?.name ?? "",
    type: asset?.type ?? "",
    owner: asset?.owner ?? "SHARED",
    quantity: asset ? formatQuantity(BigInt(asset.quantity)) : "",
    unit: asset?.unit ?? "",
    purchaseUnitPrice: asset
      ? formatToman(BigInt(asset.purchaseUnitPrice), { withUnit: false })
      : "",
    currentUnitPrice: "",
    notes: asset?.notes ?? "",
    jalaliYear: jalali.year,
    jalaliMonth: jalali.month,
    jalaliDay: jalali.day,
  };
}

/**
 * Add or edit an asset (task 3.2).
 *
 * One component for both, because the fields and the rules are the same and a
 * near-copy would drift (rule G.7). It posts to the REST API rather than
 * duplicating the write path.
 *
 * The form reshapes itself around the type, because the two shapes of asset
 * ask different questions (tasks 3.3 and 3.4): gold is a quantity at a price
 * per gram, a flat is one thing with a value. Showing "quantity: 1" and a
 * unit field for a car would be asking the user to confirm something that is
 * true by definition.
 *
 * The type cannot be changed once the asset exists: every valuation already
 * recorded against it was taken in the old shape, and changing sides would
 * make that history describe something else (see the schema comment).
 */
export function AssetDialog({
  asset,
  open,
  onOpenChange,
}: {
  /** Omit to create; pass an asset to edit it. */
  asset?: AssetDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const isEdit = asset !== undefined;

  const form = useForm<FormValues>({ defaultValues: defaultsFor(undefined) });
  const { control, reset, setValue } = form;

  React.useEffect(() => {
    if (open) reset(defaultsFor(asset));
  }, [open, asset, reset]);

  const type = useWatch({ control, name: "type" });
  const perUnit = type !== "" && isQuantityAsset(type);

  async function onSubmit(values: FormValues) {
    const purchaseDate = readJalaliFields({
      year: values.jalaliYear,
      month: values.jalaliMonth,
      day: values.jalaliDay,
    });

    if (!purchaseDate) {
      form.setError("jalaliDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const body = isEdit
      ? {
          name: values.name,
          owner: values.owner,
          ...(asset.kind === "QUANTITY"
            ? { quantity: values.quantity, unit: values.unit }
            : {}),
          purchaseUnitPrice: values.purchaseUnitPrice,
          purchaseDate: purchaseDate.toISOString(),
          notes: values.notes,
        }
      : {
          name: values.name,
          type: values.type,
          owner: values.owner,
          // A fixed asset is one of itself; the service enforces this too.
          quantity: perUnit ? values.quantity : "1",
          unit: perUnit ? values.unit : "",
          purchaseUnitPrice: values.purchaseUnitPrice,
          purchaseDate: purchaseDate.toISOString(),
          ...(values.currentUnitPrice.trim() === ""
            ? {}
            : { currentUnitPrice: values.currentUnitPrice }),
          notes: values.notes,
        };

    const response = await fetch(isEdit ? `/api/assets/${asset.id}` : "/api/assets", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      let attached = false;

      for (const [field, message] of Object.entries(payload?.error?.fields ?? {})) {
        if (field in values) {
          form.setError(field as keyof FormValues, { message });
          attached = true;
        }
      }

      if (!attached) toast.error(payload?.error?.message ?? "ذخیره دارایی انجام نشد.");

      return;
    }

    toast.success(isEdit ? "دارایی ویرایش شد." : "دارایی اضافه شد.");
    onOpenChange(false);
    router.refresh();
  }

  const priceLabel = perUnit ? "قیمت خرید هر واحد (تومان)" : "ارزش خرید (تومان)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش دارایی" : "افزودن دارایی"}</DialogTitle>
          <DialogDescription>
            مبلغ به تومان و تاریخ به تقویم شمسی وارد می‌شود.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "نام دارایی را وارد کنید." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام دارایی</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مثلاً طلای آب‌شده"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                rules={{ required: "نوع دارایی را انتخاب کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Offer the unit the type implies, so the common case
                        // needs no typing at all.
                        setValue("unit", DEFAULT_ASSET_UNIT[value as AssetType] ?? "");
                      }}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ASSET_TYPES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {ASSET_TYPE_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {owners.enabled ? (
                <FormField
                  control={form.control}
                  name="owner"
                  rules={{ required: "مالک دارایی را انتخاب کنید." }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>مالک</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="انتخاب کنید" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {owners.options.map(({ value: owner }) => (
                            <SelectItem key={owner} value={owner}>
                              {owners.label(owner)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            {perUnit ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quantity"
                  rules={{
                    required: "مقدار را وارد کنید.",
                    validate: (value) =>
                      (parseQuantity(value) ?? 0n) > 0n ||
                      "مقدار باید عددی بزرگ‌تر از صفر باشد.",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>مقدار</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          dir="ltr"
                          placeholder="18.5"
                          className="text-start"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>واحد</FormLabel>
                      <FormControl>
                        <Input placeholder="گرم" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="purchaseUnitPrice"
                rules={{
                  required: "مبلغ خرید را وارد کنید.",
                  validate: (value) =>
                    parseTomanToRial(value) !== null || "مبلغ نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{priceLabel}</FormLabel>
                    <FormControl>
                      <Input
                        // Not type="number": that rejects Persian digits and
                        // the thousands separators people actually type.
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="0"
                        className="text-start"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <JalaliDateField
                id="asset-purchase-day"
                label="تاریخ خرید (شمسی)"
                register={form.register}
                names={{ day: "jalaliDay", month: "jalaliMonth", year: "jalaliYear" }}
                error={form.formState.errors.jalaliDay?.message}
              />
            </div>

            {isEdit ? null : (
              <FormField
                control={form.control}
                name="currentUnitPrice"
                rules={{
                  validate: (value) =>
                    value.trim() === "" ||
                    parseTomanToRial(value) !== null ||
                    "مبلغ نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {perUnit ? "قیمت فعلی هر واحد (تومان)" : "ارزش فعلی (تومان)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="اختیاری"
                        className="text-start"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>یادداشت</FormLabel>
                  <FormControl>
                    <Input placeholder="اختیاری" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormNotes
              notes={[
                DATE_NOTE,
                {
                  label: "نوع دارایی",
                  text: "نوع دارایی پس از ثبت تغییر نمی‌کند؛ تاریخچهٔ قیمت‌ها بر اساس آن ثبت شده است.",
                  when: isEdit,
                },
                {
                  label: perUnit ? "قیمت فعلی هر واحد" : "ارزش فعلی",
                  text: "اگر خالی بماند، ارزش فعلی همان مبلغ خرید در نظر گرفته می‌شود. بعداً می‌توانید قیمت روز را ثبت کنید.",
                  when: !isEdit,
                },
              ]}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ذخیره…"
                  : isEdit
                    ? "ذخیره تغییرات"
                    : "افزودن دارایی"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                انصراف
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
