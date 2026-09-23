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
import { formatJalaliDate } from "@/utils/date";
import { formatToman, parseTomanToRial } from "@/utils/money";
import type { AccountDto } from "@/features/accounts/types";
import type {
  OccurrenceDto,
  RecurringPaymentDetailDto,
} from "@/features/recurring/types";

type FormValues = {
  amount: string;
  accountId: string;
  note: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

/**
 * Turn one expected occurrence into a real expense (task 5.4).
 *
 * The amount is editable, which is the difference between this and paying a
 * loan instalment: an instalment is a contract and is always the same figure,
 * while a utility bill is "about" one. The month it is not is exactly the
 * month worth recording faithfully rather than rounding to the rule.
 *
 * The date opens on the occurrence's own due date when that has already
 * passed. Dating every catch-up payment "today" would pile months of arrears
 * into one month's expense report.
 */
export function PayOccurrenceDialog({
  payment,
  occurrence,
  accounts,
  open,
  onOpenChange,
}: {
  payment: RecurringPaymentDetailDto;
  occurrence: OccurrenceDto | null;
  accounts: AccountDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    defaultValues: { amount: "", accountId: "", note: "", ...todayJalaliFields() },
  });

  const { reset } = form;

  React.useEffect(() => {
    if (!open || !occurrence) return;

    const due = new Date(occurrence.dueDate);
    // A late payment was made late, not today.
    const jalali = due < new Date() ? toJalaliFields(due) : todayJalaliFields();

    reset({
      amount: formatToman(BigInt(occurrence.amount), { withUnit: false }),
      accountId: payment.accountId ?? "",
      note: "",
      // Named explicitly rather than spread: JalaliFields uses year/month/day
      // and the form uses jalaliYear/jalaliMonth/jalaliDay, so spreading
      // silently leaves all three empty.
      jalaliYear: jalali.year,
      jalaliMonth: jalali.month,
      jalaliDay: jalali.day,
    });
  }, [open, occurrence, payment.accountId, reset]);

  const selectable = accounts.filter((account) => account.isActive);

  async function onSubmit(values: FormValues) {
    if (!occurrence) return;

    const paidAt = readJalaliFields({
      year: values.jalaliYear,
      month: values.jalaliMonth,
      day: values.jalaliDay,
    });

    if (!paidAt) {
      form.setError("jalaliDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const response = await fetch(`/api/recurring/${payment.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dueDate: occurrence.dueDate,
        amount: values.amount,
        ...(values.accountId ? { accountId: values.accountId } : {}),
        paidAt: paidAt.toISOString(),
        note: values.note,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      toast.error(body?.error?.message ?? "ثبت پرداخت انجام نشد.");
      return;
    }

    toast.success("پرداخت ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ثبت پرداخت</DialogTitle>
          <DialogDescription>
            {occurrence
              ? `${payment.name} — سررسید ${formatJalaliDate(new Date(occurrence.dueDate))}`
              : null}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="amount"
              rules={{
                required: "مبلغ را وارد کنید.",
                validate: (value) =>
                  (parseTomanToRial(value) ?? 0n) > 0n || "مبلغ نامعتبر است.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>مبلغ (تومان)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="0"
                      className="text-start"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    اگر این ماه فرق داشت، مبلغ واقعی را وارد کنید.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountId"
              rules={{ required: "حساب پرداخت را انتخاب کنید." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>از حساب</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب کنید" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectable.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <JalaliDateField
              id="occurrence-paid-day"
              label="تاریخ پرداخت (شمسی)"
              register={form.register}
              names={{ day: "jalaliDay", month: "jalaliMonth", year: "jalaliYear" }}
              error={form.formState.errors.jalaliDay?.message}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>توضیح</FormLabel>
                  <FormControl>
                    <Input placeholder="اختیاری" autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>
                    اگر خالی بماند، نام پرداخت دوره‌ای ثبت می‌شود.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "در حال ثبت…" : "ثبت پرداخت"}
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
