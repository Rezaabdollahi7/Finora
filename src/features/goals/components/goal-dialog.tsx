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
} from "@/components/common/jalali-date-field";
import { formatToman, parseTomanToRial } from "@/utils/money";
import { OWNERS, OWNER_LABELS, type Owner } from "@/features/accounts/types";
import {
  GOAL_KINDS,
  GOAL_KIND_LABELS,
  type GoalDto,
  type GoalKind,
} from "@/features/goals/types";

type FormValues = {
  name: string;
  kind: GoalKind;
  targetAmount: string;
  owner: Owner | "";
  notes: string;
  /** Blank means the goal has no deadline. */
  targetYear: string;
  targetMonth: string;
  targetDay: string;
};

function defaultsFor(goal: GoalDto | undefined): FormValues {
  const target = goal?.targetDate ? toJalaliFields(new Date(goal.targetDate)) : null;

  return {
    name: goal?.name ?? "",
    kind: goal?.kind ?? "OTHER",
    targetAmount: goal
      ? formatToman(BigInt(goal.progress.targetAmount), { withUnit: false })
      : "",
    owner: goal?.owner ?? "SHARED",
    notes: goal?.notes ?? "",
    targetYear: target?.year ?? "",
    targetMonth: target?.month ?? "",
    targetDay: target?.day ?? "",
  };
}

/**
 * Add or edit a goal (task 6.2).
 *
 * The deadline is optional and stays optional: "an emergency fund of 100M"
 * is a real goal with no date, and forcing one would make the monthly figure
 * beside it a fiction.
 */
export function GoalDialog({
  goal,
  open,
  onOpenChange,
}: {
  goal?: GoalDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = goal !== undefined;
  const form = useForm<FormValues>({ defaultValues: defaultsFor(undefined) });
  const { reset } = form;

  React.useEffect(() => {
    if (open) reset(defaultsFor(goal));
  }, [open, goal, reset]);

  async function onSubmit(values: FormValues) {
    // All three blank means "no deadline"; a partly filled date is a mistake
    // rather than an absence.
    const filled = [values.targetYear, values.targetMonth, values.targetDay].some(
      (part) => part.trim() !== "",
    );

    const targetDate = filled
      ? readJalaliFields({
          year: values.targetYear,
          month: values.targetMonth,
          day: values.targetDay,
        })
      : null;

    if (filled && !targetDate) {
      form.setError("targetDay", { message: "تاریخ نامعتبر است." });
      return;
    }

    const response = await fetch(isEdit ? `/api/goals/${goal.id}` : "/api/goals", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        kind: values.kind,
        targetAmount: values.targetAmount,
        targetDate: targetDate ? targetDate.toISOString() : null,
        owner: values.owner,
        notes: values.notes,
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

      if (!attached) toast.error(body?.error?.message ?? "ذخیره هدف انجام نشد.");

      return;
    }

    toast.success(isEdit ? "هدف ویرایش شد." : "هدف ثبت شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش هدف" : "ثبت هدف"}</DialogTitle>
          <DialogDescription>
            مبلغی که برای هدف کنار می‌گذارید هزینه نیست؛ فقط مشخص می‌کند بخشی از دارایی
            شما برای چه چیزی در نظر گرفته شده است.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: "نام هدف را وارد کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="مثلاً پس‌انداز اضطراری"
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
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GOAL_KINDS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {GOAL_KIND_LABELS[value]}
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
              <FormField
                control={form.control}
                name="targetAmount"
                rules={{
                  required: "مبلغ هدف را وارد کنید.",
                  validate: (value) =>
                    (parseTomanToRial(value) ?? 0n) > 0n || "مبلغ نامعتبر است.",
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>مبلغ هدف (تومان)</FormLabel>
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
                id="goal-target-day"
                label="تاریخ هدف (اختیاری)"
                register={form.register}
                names={{
                  day: "targetDay",
                  month: "targetMonth",
                  year: "targetYear",
                }}
                error={form.formState.errors.targetDay?.message}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
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
                        {OWNERS.map((owner) => (
                          <SelectItem key={owner} value={owner}>
                            {OWNER_LABELS[owner]}
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>یادداشت</FormLabel>
                    <FormControl>
                      <Input placeholder="اختیاری" autoComplete="off" {...field} />
                    </FormControl>
                    <FormDescription>
                      تاریخ را خالی بگذارید تا هدف بدون مهلت باشد.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ذخیره…"
                  : isEdit
                    ? "ذخیره تغییرات"
                    : "ثبت هدف"}
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
