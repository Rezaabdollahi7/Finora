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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  JalaliDateField,
  readJalaliFields,
  toJalaliFields,
  todayJalaliFields,
} from "@/components/common/jalali-date-field";
import { formatToman, parseTomanToRial } from "@/utils/money";
import { type AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  type TransactionDto,
  type TransactionType,
} from "@/features/transactions/types";
import { useOwners } from "@/features/members/components/members-provider";
import { DATE_NOTE, FormNotes } from "@/components/common/form-notes";

const NO_CATEGORY = "__none__";

type FormValues = {
  type: TransactionType;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  owner: string;
  description: string;
  jalaliYear: string;
  jalaliMonth: string;
  jalaliDay: string;
};

function defaultsFor(transaction: TransactionDto | undefined): FormValues {
  const jalali = transaction
    ? toJalaliFields(new Date(transaction.date))
    : todayJalaliFields();

  return {
    type: transaction?.type ?? "EXPENSE",
    amount: transaction
      ? formatToman(BigInt(transaction.amount), { withUnit: false })
      : "",
    accountId: transaction?.accountId ?? "",
    toAccountId: transaction?.toAccountId ?? "",
    categoryId: transaction?.categoryId ?? NO_CATEGORY,
    owner: transaction?.owner ?? "SHARED",
    description: transaction?.description ?? "",
    jalaliYear: jalali.year,
    jalaliMonth: jalali.month,
    jalaliDay: jalali.day,
  };
}

/**
 * Record or edit a transaction.
 *
 * The date is entered in Jalali and converted to a UTC instant here, at the
 * edge, so no Jalali value ever reaches the API or the database (rule G.5).
 */
export function TransactionDialog({
  transaction,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  transaction?: TransactionDto;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const isEdit = transaction !== undefined;
  const form = useForm<FormValues>({ defaultValues: defaultsFor(undefined) });
  const { control, reset, setValue } = form;

  React.useEffect(() => {
    if (open) reset(defaultsFor(transaction));
  }, [open, transaction, reset]);

  // useWatch subscribes to a single field rather than re-rendering on every
  // keystroke anywhere in the form, which is also what React's compiler can
  // reason about.
  const type = useWatch({ control, name: "type" });
  const accountId = useWatch({ control, name: "accountId" });
  const isTransfer = type === "TRANSFER";

  // Only active accounts can take new transactions, but an archived one the
  // transaction already uses must stay listed or editing would silently move
  // the entry to a different account.
  const selectableAccounts = accounts.filter(
    (account) =>
      account.isActive ||
      account.id === transaction?.accountId ||
      account.id === transaction?.toAccountId,
  );

  const categoryKind = type === "INCOME" ? "INCOME" : "EXPENSE";
  const relevantCategories = categories.filter((root) => root.kind === categoryKind);

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

    const response = await fetch(
      isEdit ? `/api/transactions/${transaction.id}` : "/api/transactions",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          amount: values.amount,
          accountId: values.accountId,
          toAccountId: isTransfer ? values.toAccountId : null,
          categoryId:
            isTransfer || values.categoryId === NO_CATEGORY ? null : values.categoryId,
          owner: values.owner,
          description: values.description,
          date: date.toISOString(),
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

      if (!attached) toast.error(payload?.error?.message ?? "ثبت تراکنش انجام نشد.");

      return;
    }

    toast.success(isEdit ? "تراکنش ویرایش شد." : "تراکنش ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش تراکنش" : "ثبت تراکنش"}</DialogTitle>
          <DialogDescription>
            مبلغ به تومان و تاریخ به تقویم شمسی وارد می‌شود.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع</FormLabel>
                  <Tabs
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // A transfer has no category and a non-transfer has no
                      // destination; clearing here keeps the payload valid.
                      if (value === "TRANSFER") setValue("categoryId", NO_CATEGORY);
                      else setValue("toAccountId", "");
                    }}
                  >
                    <TabsList className="w-full">
                      {TRANSACTION_TYPES.map((value) => (
                        <TabsTrigger key={value} value={value} className="flex-1">
                          {TRANSACTION_TYPE_LABELS[value]}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              rules={{
                required: "مبلغ را وارد کنید.",
                validate: (value) => {
                  const rial = parseTomanToRial(value);
                  if (rial === null) return "مبلغ نامعتبر است.";
                  if (rial <= 0n) return "مبلغ باید بزرگ‌تر از صفر باشد.";
                  return true;
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>مبلغ (تومان)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      dir="ltr"
                      className="text-start"
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
                name="accountId"
                rules={{ required: "حساب را انتخاب کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isTransfer ? "از حساب" : "حساب"}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              {isTransfer ? (
                <FormField
                  control={form.control}
                  name="toAccountId"
                  rules={{
                    required: "حساب مقصد را انتخاب کنید.",
                    validate: (value) =>
                      value !== accountId || "حساب مبدأ و مقصد نمی‌توانند یکی باشند.",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>به حساب</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="انتخاب کنید" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
              ) : (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>دسته‌بندی</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="بدون دسته" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_CATEGORY}>بدون دسته</SelectItem>
                          {/* Radix requires SelectLabel to sit inside a
                              SelectGroup; without it the whole select throws
                              at render time. */}
                          {relevantCategories.map((root) => (
                            <SelectGroup key={root.id}>
                              <SelectLabel>{root.name}</SelectLabel>
                              {[root, ...root.children].map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.parentId
                                    ? `— ${category.name}`
                                    : category.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {owners.enabled ? (
                <FormField
                  control={form.control}
                  name="owner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>مالک</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                    </FormItem>
                  )}
                />
              ) : null}

              <JalaliDateField
                id="jalali-day"
                label="تاریخ (شمسی)"
                register={form.register}
                names={{ day: "jalaliDay", month: "jalaliMonth", year: "jalaliYear" }}
                error={form.formState.errors.jalaliDay?.message}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>توضیح</FormLabel>
                  <FormControl>
                    <Input placeholder="اختیاری" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormNotes notes={[DATE_NOTE]} />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ذخیره…"
                  : isEdit
                    ? "ذخیره تغییرات"
                    : "ثبت تراکنش"}
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
