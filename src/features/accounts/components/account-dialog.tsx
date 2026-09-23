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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { formatToman, parseTomanToRial } from "@/utils/money";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type AccountDto,
  type AccountType,
  type Owner,
} from "@/features/accounts/types";
import { useOwners } from "@/features/members/components/members-provider";
import { FormNotes } from "@/components/common/form-notes";
import { MoneyInput } from "@/components/common/money-input";

type FormValues = {
  name: string;
  type: AccountType | "";
  owner: Owner | "";
  /** Toman, as typed. Converted to Rial by the API's schema. */
  initialBalance: string;
};

/**
 * Create and edit dialog.
 *
 * One component for both, because the fields and the rules are identical and
 * a second near-copy would drift (rule G.7). It posts to the REST API from
 * 1.2 rather than duplicating the write path, so the API is the application's
 * real code path and not a parallel surface that can rot.
 */
function AccountDialog({
  account,
  open,
  onOpenChange,
}: {
  /** Omit to create; pass an account to edit it. */
  account?: AccountDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owners = useOwners();
  const router = useRouter();
  const isEdit = account !== undefined;

  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      type: "",
      owner: "",
      initialBalance: "",
    },
  });

  const { reset } = form;

  // Re-seed whenever the dialog opens, so editing a different account does
  // not show the previous one's values for a frame.
  React.useEffect(() => {
    if (!open) return;

    reset({
      name: account?.name ?? "",
      type: account?.type ?? "",
      owner: account?.owner ?? "",
      initialBalance: account
        ? formatToman(BigInt(account.initialBalance), { withUnit: false })
        : "",
    });
  }, [open, account, reset]);

  async function onSubmit(values: FormValues) {
    const response = await fetch(
      isEdit ? `/api/accounts/${account.id}` : "/api/accounts",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          owner: values.owner,
          initialBalance:
            values.initialBalance.trim() === "" ? "0" : values.initialBalance,
        }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string; fields?: Record<string, string> };
      } | null;

      // Field errors from the API land on the matching input; anything else
      // is shown once, as a toast.
      const fields = payload?.error?.fields ?? {};
      let attached = false;

      for (const [field, message] of Object.entries(fields)) {
        if (field in values) {
          form.setError(field as keyof FormValues, { message });
          attached = true;
        }
      }

      if (!attached) {
        toast.error(payload?.error?.message ?? "ذخیره حساب انجام نشد.");
      }

      return;
    }

    toast.success(isEdit ? "حساب ویرایش شد." : "حساب اضافه شد.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "ویرایش حساب" : "افزودن حساب"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "تغییرات روی این حساب اعمال می‌شود."
              : "حسابی که پول در آن نگهداری می‌شود را ثبت کنید."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "نام حساب را وارد کنید." }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام حساب</FormLabel>
                  <FormControl>
                    <Input placeholder="مثلاً بانک ملت" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                rules={{ required: "نوع حساب را انتخاب کنید." }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب کنید" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ACCOUNT_TYPE_LABELS[type]}
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
                  rules={{ required: "مالک حساب را انتخاب کنید." }}
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

            <FormField
              control={form.control}
              name="initialBalance"
              rules={{
                validate: (value) =>
                  value.trim() === "" ||
                  parseTomanToRial(value) !== null ||
                  "مبلغ نامعتبر است.",
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>موجودی اولیه (تومان)</FormLabel>
                  <FormControl>
                    <MoneyInput placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormNotes
              notes={[
                {
                  label: "موجودی اولیه",
                  text: "موجودی حساب در لحظه‌ای که آن را اضافه می‌کنید. بعداً با تراکنش‌ها به‌روز می‌شود.",
                },
              ]}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "در حال ذخیره…"
                  : isEdit
                    ? "ذخیره تغییرات"
                    : "افزودن حساب"}
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

export { AccountDialog };
