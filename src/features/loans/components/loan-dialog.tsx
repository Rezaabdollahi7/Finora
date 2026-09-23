"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { formatToman, parseTomanToRial } from "@/utils/money";
import { parseNumber } from "@/utils/number";
import { type AccountDto, type Owner } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import { MAX_PAYMENT_DAY } from "@/features/loans/schedule";
import type { LoanDto } from "@/features/loans/types";
import { useOwners } from "@/features/members/components/members-provider";

const NO_CATEGORY = "__none__";
const NO_ACCOUNT = "__none__";

type FormValues = {
  name: string;
  provider: string;
  owner: Owner | "";
  principalAmount: string;
  interestRate: string;
  installmentAmount: string;
  installmentCount: string;
  paymentDay: string;
  categoryId: string;
  accountId: string;
  notes: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

function defaultsFor(loan: LoanDto | undefined): FormValues {
  const jalali = loan ? toJalaliFields(new Date(loan.startDate)) : todayJalaliFields();

  return {
    name: loan?.name ?? "",
    provider: loan?.provider ?? "",
    owner: loan?.owner ?? "SHARED",
    principalAmount: loan
      ? formatToman(BigInt(loan.principalAmount), { withUnit: false })
      : "",
    // Basis points back to the percentage the user typed.
    interestRate: loan ? String(loan.interestRate / 100) : "",
    installmentAmount: loan
      ? formatToman(BigInt(loan.installmentAmount), { withUnit: false })
      : "",
    installmentCount: loan ? String(loan.installmentCount) : "",
    paymentDay: loan ? String(loan.paymentDay) : "",
    categoryId: loan?.categoryId ?? NO_CATEGORY,
    accountId: loan?.accountId ?? NO_ACCOUNT,
    notes: loan?.notes ?? "",
    jalaliYear: jalali.year,
    jalaliMonth: jalali.month,
    jalaliDay: jalali.day,
  };
}

/** Flatten the category tree to the expense leaves a loan payment can use. */
function expenseOptions(categories: CategoryTreeNode[]) {
  return categories
    .filter((root) => root.kind === "EXPENSE")
    .flatMap((root) =>
      root.children.length > 0
        ? root.children.map((child) => ({
            id: child.id,
            label: `${root.name} › ${child.name}`,
          }))
        : [{ id: root.id, label: root.name }],
    );
}

/**
 * Add or edit a loan (task 4.2).
 *
 * One component for both. Editing warns before it regenerates: changing the
 * instalment, the count, the start date or the payment day rebuilds every
 * instalment that is still owed, and a user who came to fix a typo in the
 * provider's name should not discover that by watching the schedule move.
 */
export function LoanDialog({
  loan,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  loan?: LoanDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const isEdit = loan !== undefined;
  const form = useForm<FormValues>({ defaultValues: defaultsFor(undefined) });
  const { reset } = form;

  React.useEffect(() => {
    if (open) reset(defaultsFor(loan));
  }, [open, loan, reset]);

  const selectableAccounts = accounts.filter(
    (account) => account.isActive || account.id === loan?.accountId,
  );
  const categoryOptions = expenseOptions(categories);

  async function onSubmit(values: FormValues) {
    const startDate = readJalaliFields({
      year: values.jalaliYear,
      month: values.jalaliMonth,
      day: values.jalaliDay,
    });

    if (!startDate) {
      form.setError("jalaliDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const body = {
      name: values.name,
      provider: values.provider,
      owner: values.owner,
      principalAmount: values.principalAmount,
      interestRate: values.interestRate,
      installmentAmount: values.installmentAmount,
      installmentCount: values.installmentCount,
      paymentDay: values.paymentDay,
      startDate: startDate.toISOString(),
      categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
      accountId: values.accountId === NO_ACCOUNT ? null : values.accountId,
      notes: values.notes,
    };

    const response = await fetch(isEdit ? `/api/loans/${loan.id}` : "/api/loans", {
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

      if (!attached) toast.error(payload?.error?.message ?? "ذخیره وام انجام نشد.");

      return;
    }

    toast.success(isEdit ? "وام ویرایش شد." : "وام ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش وام" : "ثبت وام"}</DialogTitle>
          <DialogDescription>
            مبلغ به تومان و تاریخ به تقویم شمسی وارد می‌شود. جدول اقساط از روی همین
            مقادیر ساخته می‌شود.
          </DialogDescription>
        </DialogHeader>

        {isEdit && loan.progress.paid > 0 ? (
          <Alert variant="warning">
            <AlertDescription>
              تغییر مبلغ قسط، تعداد اقساط، تاریخ شروع یا روز پرداخت، اقساط پرداخت‌نشده
              را دوباره می‌سازد. اقساطی که پرداخت شده‌اند دست‌نخورده می‌مانند.
            </AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "نام وام را وارد کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام وام</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثلاً وام مسکن"
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
                name="provider"
                rules={{ required: "نام بانک یا وام‌دهنده را وارد کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>وام‌دهنده</FormLabel>
                    <FormControl>
                      <Input placeholder="بانک مسکن" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="principalAmount"
                rules={{
                  required: "مبلغ وام را وارد کنید.",
                  validate: (value) =>
                    parseTomanToRial(value) !== null || "مبلغ نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>مبلغ وام (تومان)</FormLabel>
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
                      مبلغی که دریافت کرده‌اید، نه مجموع اقساط.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestRate"
                rules={{
                  validate: (value) =>
                    value.trim() === "" ||
                    (parseNumber(value) ?? -1) >= 0 ||
                    "نرخ سود نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نرخ سود سالانه (٪)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        dir="ltr"
                        placeholder="23"
                        className="text-start"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="installmentAmount"
                rules={{
                  required: "مبلغ قسط را وارد کنید.",
                  validate: (value) =>
                    (parseTomanToRial(value) ?? 0n) > 0n || "مبلغ نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>مبلغ هر قسط (تومان)</FormLabel>
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

              <FormField
                control={form.control}
                name="installmentCount"
                rules={{
                  required: "تعداد اقساط را وارد کنید.",
                  validate: (value) =>
                    (parseNumber(value) ?? 0) >= 1 || "تعداد اقساط نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تعداد اقساط</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="60"
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
                name="paymentDay"
                rules={{
                  required: "روز پرداخت را وارد کنید.",
                  validate: (value) => {
                    const day = parseNumber(value);
                    return (
                      (day !== null && day >= 1 && day <= MAX_PAYMENT_DAY) ||
                      "روز پرداخت باید بین ۱ تا ۳۱ باشد."
                    );
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>روز پرداخت</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="5"
                        className="text-start"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      روز ماه شمسی. ماه کوتاه‌تر، آخرین روز خودش را می‌گیرد.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <JalaliDateField
                id="loan-start-day"
                label="تاریخ شروع (شمسی)"
                register={form.register}
                names={{ day: "jalaliDay", month: "jalaliMonth", year: "jalaliYear" }}
                error={form.formState.errors.jalaliDay?.message}
              />

              {owners.enabled ? (
                <FormField
                  control={form.control}
                  name="owner"
                  rules={{ required: "مالک وام را انتخاب کنید." }}
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

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>حساب پرداخت</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_ACCOUNT}>انتخاب نشده</SelectItem>
                        {selectableAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      اقساط به‌طور پیش‌فرض از این حساب پرداخت می‌شوند.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>دسته‌بندی هزینه</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>بدون دسته</SelectItem>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      هزینه هر قسط زیر این دسته ثبت می‌شود.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ذخیره…"
                  : isEdit
                    ? "ذخیره تغییرات"
                    : "ثبت وام"}
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
