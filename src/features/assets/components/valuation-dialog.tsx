"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  JalaliDateField,
  readJalaliFields,
  todayJalaliFields,
} from "@/components/common/jalali-date-field";
import { formatToman, parseTomanToRial } from "@/utils/money";
import { isQuantityAsset, type AssetDto } from "@/features/assets/types";

type FormValues = {
  unitPrice: string;
  note: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

/**
 * Record what an asset is worth now (task 3.8).
 *
 * Deliberately not part of the edit dialog. Re-pricing is the action a
 * household performs most often and it is the one action that appends to
 * history rather than overwriting a field — putting it beside "name" and
 * "owner" would make it look like just another edit.
 *
 * The date defaults to today and is editable, so a price that was true last
 * week can be filed under last week rather than being back-dated by hand
 * afterwards. A price recorded for a date that already has one replaces it:
 * two prices for the same instant are a correction, not two facts.
 */
export function ValuationDialog({
  asset,
  open,
  onOpenChange,
}: {
  asset: AssetDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    defaultValues: { unitPrice: "", note: "", ...todayJalaliFields() },
  });

  const { reset } = form;
  const perUnit = isQuantityAsset(asset.type);

  React.useEffect(() => {
    if (!open) return;

    const today = todayJalaliFields();

    reset({
      // Seeded with the price in force, so a small correction is an edit of a
      // number rather than a retyping of it.
      unitPrice: formatToman(BigInt(asset.currentUnitPrice), { withUnit: false }),
      note: "",
      jalaliYear: today.year,
      jalaliMonth: today.month,
      jalaliDay: today.day,
    });
  }, [open, asset, reset]);

  async function onSubmit(values: FormValues) {
    const asOf = readJalaliFields({
      year: values.jalaliYear,
      month: values.jalaliMonth,
      day: values.jalaliDay,
    });

    if (!asOf) {
      form.setError("jalaliDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const response = await fetch(`/api/assets/${asset.id}/valuations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitPrice: values.unitPrice,
        asOf: asOf.toISOString(),
        note: values.note,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      const message = payload?.error?.fields?.["unitPrice"];

      if (message) form.setError("unitPrice", { message });
      else toast.error(payload?.error?.message ?? "ثبت قیمت انجام نشد.");

      return;
    }

    toast.success("قیمت جدید ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ثبت قیمت روز</DialogTitle>
          <DialogDescription>
            قیمت جدید به تاریخچه اضافه می‌شود و مقدارهای قبلی دست‌نخورده می‌مانند.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="unitPrice"
              rules={{
                required: "مبلغ را وارد کنید.",
                validate: (value) =>
                  parseTomanToRial(value) !== null || "مبلغ نامعتبر است.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {perUnit
                      ? `قیمت هر ${asset.unit ?? "واحد"} (تومان)`
                      : "ارزش فعلی (تومان)"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="0"
                      className="text-start"
                      autoComplete="off"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  {perUnit ? (
                    <FormDescription>
                      ارزش کل از ضرب این مبلغ در مقدار نگهداری‌شده به دست می‌آید.
                    </FormDescription>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <JalaliDateField
              id="valuation-day"
              label="تاریخ (شمسی)"
              register={form.register}
              names={{ day: "jalaliDay", month: "jalaliMonth", year: "jalaliYear" }}
              error={form.formState.errors.jalaliDay?.message}
            />

            <FormField
              control={form.control}
              name="note"
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

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "در حال ذخیره…" : "ثبت قیمت"}
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
