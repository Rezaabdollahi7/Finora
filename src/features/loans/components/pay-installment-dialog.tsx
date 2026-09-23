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
import { Money } from "@/components/common/money";
import {
  JalaliDateField,
  readJalaliFields,
  toJalaliFields,
  todayJalaliFields,
} from "@/components/common/jalali-date-field";
import { formatJalaliDate } from "@/utils/date";
import type { AccountDto } from "@/features/accounts/types";
import type { InstallmentDto, LoanDetailDto } from "@/features/loans/types";

type FormValues = {
  accountId: string;
  note: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

/**
 * Record a payment (task 4.4).
 *
 * The date matters more than it looks. An overdue instalment is usually paid
 * late, and dating every catch-up payment "today" would pile months of
 * arrears into one month's expense report — the ledger would say the
 * household spent four times its income in Shahrivar. So the date defaults
 * to today but opens on the instalment's own due date when that has already
 * passed, which is the answer for the case this dialog exists to serve.
 *
 * The account defaults to the loan's, and can be changed for the month it
 * came out of a different one.
 */
export function PayInstallmentDialog({
  loan,
  installment,
  accounts,
  open,
  onOpenChange,
}: {
  loan: LoanDetailDto;
  installment: InstallmentDto | null;
  accounts: AccountDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<FormValues>({
    defaultValues: { accountId: "", note: "", ...todayJalaliFields() },
  });

  const { reset } = form;

  React.useEffect(() => {
    if (!open || !installment) return;

    const due = new Date(installment.dueDate);
    // A late instalment was paid late, not today.
    const jalali = due < new Date() ? toJalaliFields(due) : todayJalaliFields();

    reset({
      accountId: loan.accountId ?? "",
      note: "",
      // Named explicitly rather than spread: JalaliFields uses year/month/day
      // and the form uses jalaliYear/jalaliMonth/jalaliDay, so spreading
      // silently leaves all three empty.
      jalaliYear: jalali.year,
      jalaliMonth: jalali.month,
      jalaliDay: jalali.day,
    });
  }, [open, installment, loan.accountId, reset]);

  const selectable = accounts.filter((account) => account.isActive);

  async function onSubmit(values: FormValues) {
    if (!installment) return;

    const paidAt = readJalaliFields({
      year: values.jalaliYear,
      month: values.jalaliMonth,
      day: values.jalaliDay,
    });

    if (!paidAt) {
      form.setError("jalaliDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const response = await fetch(
      `/api/loans/${loan.id}/installments/${installment.number}/pay`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(values.accountId ? { accountId: values.accountId } : {}),
          paidAt: paidAt.toISOString(),
          note: values.note,
        }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      toast.error(payload?.error?.message ?? "ثبت پرداخت انجام نشد.");
      return;
    }

    toast.success("قسط پرداخت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>پرداخت قسط</DialogTitle>
          <DialogDescription>
            {installment ? (
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span>
                  قسط {installment.number.toLocaleString("fa-IR")} — سررسید{" "}
                  {formatJalaliDate(new Date(installment.dueDate))}
                </span>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {installment ? (
          <div className="flex items-baseline justify-between gap-4 rounded-lg bg-primary-soft px-4 py-3">
            <span className="text-body text-muted-foreground">مبلغ</span>
            <Money rial={installment.amount} className="text-h3 font-bold" />
          </div>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
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
              id="payment-day"
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
                    اگر خالی بماند، شماره قسط و نام وام ثبت می‌شود.
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
