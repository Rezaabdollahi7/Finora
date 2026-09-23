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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { formatToman, parseTomanToRial } from "@/utils/money";
import type { CategoryTreeNode } from "@/features/categories/types";
import { type Owner } from "@/features/accounts/types";
import type { BudgetLineDto } from "@/features/budgets/types";
import { useOwners } from "@/features/members/components/members-provider";
import { FormNotes } from "@/components/common/form-notes";
import { MoneyInput } from "@/components/common/money-input";

const NO_CATEGORY = "";

type FormValues = {
  categoryId: string;
  amount: string;
  rollover: "on" | "off";
};

/** Every expense category, parents and children, as flat picker options. */
function expenseOptions(categories: CategoryTreeNode[]) {
  return categories
    .filter((root) => root.kind === "EXPENSE")
    .flatMap((root) => [
      { id: root.id, label: root.name },
      ...root.children.map((child) => ({
        id: child.id,
        label: `${root.name} › ${child.name}`,
      })),
    ]);
}

/**
 * Set or change a category's budget (task 5.8).
 *
 * The month is not a field. A budget always applies from the month on
 * screen forward, and the months before it keep the figures they were
 * actually measured against (rule G.4) — offering a month picker here would
 * invite rewriting a month that has already been reported on.
 */
export function BudgetDialog({
  line,
  month,
  monthLabel,
  owner,
  categories,
  budgetedIds,
  open,
  onOpenChange,
}: {
  /** The line being edited, or undefined when adding a budget. */
  line?: BudgetLineDto;
  /** The absolute Jalali month the budget starts applying from. */
  month: number;
  monthLabel: string;
  /** Whose spending this budget will measure (task 7.5). */
  owner: Owner;
  categories: CategoryTreeNode[];
  /** Categories that already have a budget this month; hidden when adding. */
  budgetedIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const isEdit = line !== undefined;
  const form = useForm<FormValues>({
    defaultValues: { categoryId: NO_CATEGORY, amount: "", rollover: "off" },
  });

  const { reset } = form;

  React.useEffect(() => {
    if (!open) return;

    reset({
      categoryId: line?.categoryId ?? NO_CATEGORY,
      amount: line ? formatToman(BigInt(line.amount), { withUnit: false }) : "",
      rollover: line?.rollover ? "on" : "off",
    });
  }, [open, line, reset]);

  const taken = new Set(budgetedIds);
  const options = expenseOptions(categories).filter(
    (option) => isEdit || !taken.has(option.id),
  );

  async function onSubmit(values: FormValues) {
    const response = await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: values.categoryId,
        owner,
        amount: values.amount,
        fromMonth: month,
        rollover: values.rollover === "on",
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      let attached = false;

      for (const [field, message] of Object.entries(body?.error?.fields ?? {})) {
        if (field in values) {
          form.setError(field as keyof FormValues, { message });
          attached = true;
        }
      }

      if (!attached) toast.error(body?.error?.message ?? "ذخیره بودجه انجام نشد.");

      return;
    }

    toast.success(isEdit ? "بودجه ویرایش شد." : "بودجه ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش بودجه" : "تعیین بودجه"}</DialogTitle>
          <DialogDescription>
            {owner === "SHARED"
              ? `این بودجه مشترک از ${monthLabel} به بعد اعمال می‌شود و فقط خرج مشترک خانه را می‌سنجد.`
              : `این بودجه شخصی ${owners.label(owner)} از ${monthLabel} به بعد اعمال می‌شود و روی بودجه مشترک اثری ندارد.`}{" "}
            ماه‌های پیش از آن با همان سقف قبلی خود باقی می‌مانند.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="categoryId"
              rules={{ required: "دسته‌بندی را انتخاب کنید." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>دسته‌بندی</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب کنید" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((option) => (
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

            <FormField
              control={form.control}
              name="amount"
              rules={{
                required: "مبلغ را وارد کنید.",
                validate: (value) =>
                  (parseTomanToRial(value) ?? -1n) >= 0n || "مبلغ نامعتبر است.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سقف ماهانه (تومان)</FormLabel>
                  <FormControl>
                    <MoneyInput placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rollover"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>انتقال مانده به ماه بعد</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="off">خیر</SelectItem>
                      <SelectItem value="on">بله</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormNotes
              notes={[
                {
                  label: "دسته‌بندی",
                  text: "بودجه یک دسته والد، خرج زیرمجموعه‌هایش را هم در بر می‌گیرد.",
                },
                {
                  label: "انتقال مانده به ماه بعد",
                  text: "تنها مانده استفاده‌نشده منتقل می‌شود؛ بیش‌ازحد خرج‌کردن به ماه بعد بدهی نمی‌برد.",
                },
              ]}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "در حال ذخیره…" : "ذخیره بودجه"}
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
