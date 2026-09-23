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
import { parseNumber } from "@/utils/number";
import { type AccountDto, type Owner } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_INTERVAL_UNITS,
  type RecurrenceFrequency,
} from "@/features/recurring/recurrence";
import type { RecurringPaymentDto } from "@/features/recurring/types";
import { useOwners } from "@/features/members/components/members-provider";
import { DATE_NOTE, FormNotes } from "@/components/common/form-notes";

const NO_CATEGORY = "__none__";
const NO_ACCOUNT = "__none__";

type FormValues = {
  name: string;
  amount: string;
  frequency: RecurrenceFrequency;
  interval: string;
  paymentDay: string;
  owner: Owner | "";
  categoryId: string;
  accountId: string;
  notes: string;
  startYear: string;
  startMonth: string;
  startDay: string;
  /** Blank means the rule never ends. */
  endYear: string;
  endMonth: string;
  endDay: string;
};

function defaultsFor(payment: RecurringPaymentDto | undefined): FormValues {
  const start = payment
    ? toJalaliFields(new Date(payment.startDate))
    : todayJalaliFields();
  const end = payment?.endDate ? toJalaliFields(new Date(payment.endDate)) : null;

  return {
    name: payment?.name ?? "",
    amount: payment ? formatToman(BigInt(payment.amount), { withUnit: false }) : "",
    frequency: payment?.frequency ?? "MONTHLY",
    interval: payment ? String(payment.interval) : "1",
    paymentDay: payment?.paymentDay ? String(payment.paymentDay) : "",
    owner: payment?.owner ?? "SHARED",
    categoryId: payment?.categoryId ?? NO_CATEGORY,
    accountId: payment?.accountId ?? NO_ACCOUNT,
    notes: payment?.notes ?? "",
    startYear: start.year,
    startMonth: start.month,
    startDay: start.day,
    endYear: end?.year ?? "",
    endMonth: end?.month ?? "",
    endDay: end?.day ?? "",
  };
}

/** The expense leaves a recurring payment can be filed under. */
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
 * Add or edit a recurring payment (task 5.5).
 *
 * The form reshapes itself around the frequency, because the cadences ask
 * different questions: only a monthly rule has a day of the month, and the
 * interval's unit changes with it — "every 2 months" and "every 2 days" are
 * the same field meaning different things.
 */
export function RecurringDialog({
  payment,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  payment?: RecurringPaymentDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const isEdit = payment !== undefined;
  const form = useForm<FormValues>({ defaultValues: defaultsFor(undefined) });
  const { control, reset } = form;

  React.useEffect(() => {
    if (open) reset(defaultsFor(payment));
  }, [open, payment, reset]);

  const frequency = useWatch({ control, name: "frequency" });
  const isMonthly = frequency === "MONTHLY";

  const selectableAccounts = accounts.filter(
    (account) => account.isActive || account.id === payment?.accountId,
  );
  const categoryOptions = expenseOptions(categories);

  async function onSubmit(values: FormValues) {
    const startDate = readJalaliFields({
      year: values.startYear,
      month: values.startMonth,
      day: values.startDay,
    });

    if (!startDate) {
      form.setError("startDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    // All three blank means "no end"; a partly filled date is a mistake
    // rather than an absence.
    const endFilled = [values.endYear, values.endMonth, values.endDay].some(
      (part) => part.trim() !== "",
    );
    const endDate = endFilled
      ? readJalaliFields({
          year: values.endYear,
          month: values.endMonth,
          day: values.endDay,
        })
      : null;

    if (endFilled && !endDate) {
      form.setError("endDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const response = await fetch(
      isEdit ? `/api/recurring/${payment.id}` : "/api/recurring",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          amount: values.amount,
          frequency: values.frequency,
          interval: values.interval,
          paymentDay: isMonthly && values.paymentDay ? values.paymentDay : null,
          startDate: startDate.toISOString(),
          endDate: endDate ? endDate.toISOString() : null,
          owner: values.owner,
          categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
          accountId: values.accountId === NO_ACCOUNT ? null : values.accountId,
          notes: values.notes,
        }),
      },
    );

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

      if (!attached) toast.error(payload?.error?.message ?? "ذخیره پرداخت انجام نشد.");

      return;
    }

    toast.success(isEdit ? "پرداخت ویرایش شد." : "پرداخت دوره‌ای ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "ویرایش پرداخت دوره‌ای" : "ثبت پرداخت دوره‌ای"}
          </DialogTitle>
          <DialogDescription>
            سررسیدهای آینده از روی همین قاعده ساخته می‌شوند و تا زمانی که پرداخت نشوند،
            هزینه‌ای ثبت نمی‌شود.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "نام پرداخت را وارد کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام</FormLabel>
                    <FormControl>
                      <Input placeholder="مثلاً اجاره" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>دوره</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECURRENCE_FREQUENCIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {RECURRENCE_FREQUENCY_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interval"
                rules={{
                  validate: (value) =>
                    (parseNumber(value) ?? 0) >= 1 || "فاصله نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>هر چند {RECURRENCE_INTERVAL_UNITS[frequency]}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        dir="ltr"
                        placeholder="1"
                        className="text-start"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isMonthly ? (
                <FormField
                  control={form.control}
                  name="paymentDay"
                  rules={{
                    validate: (value) => {
                      if (value.trim() === "") return true;
                      const day = parseNumber(value);
                      return (
                        (day !== null && day >= 1 && day <= 31) ||
                        "روز پرداخت باید بین ۱ تا ۳۱ باشد."
                      );
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>روز ماه</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          dir="ltr"
                          placeholder="۱"
                          className="text-start"
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <JalaliDateField
                id="recurring-start-day"
                label="تاریخ شروع (شمسی)"
                register={form.register}
                names={{ day: "startDay", month: "startMonth", year: "startYear" }}
                error={form.formState.errors.startDay?.message}
              />

              <JalaliDateField
                id="recurring-end-day"
                label="تاریخ پایان (اختیاری)"
                register={form.register}
                names={{ day: "endDay", month: "endMonth", year: "endYear" }}
                error={form.formState.errors.endDay?.message}
              />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {owners.enabled ? (
                <FormField
                  control={form.control}
                  name="owner"
                  rules={{ required: "مالک را انتخاب کنید." }}
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
            </div>

            <FormNotes
              notes={[
                DATE_NOTE,
                {
                  label: "روز ماه",
                  text: "خالی بگذارید تا روز شروع در نظر گرفته شود.",
                },
              ]}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ذخیره…"
                  : isEdit
                    ? "ذخیره تغییرات"
                    : "ثبت پرداخت"}
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
