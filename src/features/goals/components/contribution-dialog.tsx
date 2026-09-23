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
import { Money } from "@/components/common/money";
import { parseTomanToRial } from "@/utils/money";
import type { GoalDto } from "@/features/goals/types";

type FormValues = {
  amount: string;
  note: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

/**
 * Put money aside for a goal, or take some back out (task 6.4).
 *
 * No account is asked for, and that is deliberate: this does not move money.
 * It records that part of what the household already has is spoken for. A
 * transfer between accounts is a separate thing, recorded on the
 * transactions page, and conflating the two would make saving look like
 * spending.
 */
export function ContributionDialog({
  goal,
  withdrawal = false,
  open,
  onOpenChange,
}: {
  goal: GoalDto;
  /** True to take money back out instead of putting it in. */
  withdrawal?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    defaultValues: { amount: "", note: "", ...todayJalaliFields() },
  });

  const { reset } = form;

  React.useEffect(() => {
    if (!open) return;

    const today = todayJalaliFields();

    reset({
      amount: "",
      note: "",
      // Named explicitly rather than spread: JalaliFields uses year/month/day
      // and the form uses jalaliYear/jalaliMonth/jalaliDay, so spreading
      // silently leaves all three empty.
      jalaliYear: today.year,
      jalaliMonth: today.month,
      jalaliDay: today.day,
    });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    const date = readJalaliFields({
      year: values.jalaliYear,
      month: values.jalaliMonth,
      day: values.jalaliDay,
    });

    if (!date) {
      form.setError("jalaliDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const response = await fetch(`/api/goals/${goal.id}/contributions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: values.amount,
        date: date.toISOString(),
        isWithdrawal: withdrawal,
        note: values.note,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      toast.error(body?.error?.message ?? "ثبت مبلغ انجام نشد.");
      return;
    }

    toast.success(withdrawal ? "برداشت ثبت شد." : "مبلغ به هدف اضافه شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{withdrawal ? "برداشت از هدف" : "افزودن به هدف"}</DialogTitle>
          <DialogDescription>
            {withdrawal
              ? "این مبلغ از کنارگذاشته‌های این هدف کم می‌شود. تراکنشی ثبت نمی‌شود."
              : "این مبلغ هزینه نیست؛ فقط مشخص می‌کند بخشی از دارایی شما برای این هدف کنار گذاشته شده است."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-baseline justify-between gap-4 rounded-lg bg-primary-soft px-4 py-3">
          <span className="text-body text-muted-foreground">
            {withdrawal ? "کنارگذاشته‌شده" : "باقی‌مانده تا هدف"}
          </span>
          <Money
            rial={
              withdrawal ? goal.progress.currentAmount : goal.progress.remainingAmount
            }
            className="text-h3 font-bold"
          />
        </div>

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
                  <FormMessage />
                </FormItem>
              )}
            />

            <JalaliDateField
              id="contribution-day"
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
                  <FormLabel>توضیح</FormLabel>
                  <FormControl>
                    <Input placeholder="اختیاری" autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>
                    برای جابه‌جایی واقعی پول بین حساب‌ها، از بخش تراکنش‌ها یک انتقال ثبت
                    کنید.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ثبت…"
                  : withdrawal
                    ? "ثبت برداشت"
                    : "افزودن"}
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
