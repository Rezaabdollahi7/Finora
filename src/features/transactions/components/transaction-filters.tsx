"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { type AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import {
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
} from "@/features/transactions/types";
import { useOwners } from "@/features/members/components/members-provider";
import { MoneyInput } from "@/components/common/money-input";

const ALL = "__all__";
const UNCATEGORISED = "none";

/**
 * Filters live in the URL.
 *
 * That makes a filtered view shareable and survivable across a refresh, lets
 * the browser's back button undo a filter, and — because the page is a server
 * component — means the filtering happens in the database rather than on a
 * list the browser had to download first (task 2.10's concern, applied early).
 */
export function TransactionFilters({
  accounts,
  categories,
  total,
}: {
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
  total: number;
}) {
  const owners = useOwners();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const get = (key: string) => searchParams.get(key) ?? "";

  const apply = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "" || value === ALL) next.delete(key);
        else next.set(key, value);
      }

      // Any filter change invalidates the current page number.
      next.delete("page");

      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const activeCount = [
    "type",
    "accountId",
    "owner",
    "categoryId",
    "dateFrom",
    "dateTo",
    "amountMin",
    "amountMax",
    "search",
  ].filter((key) => searchParams.get(key)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={get("type") || ALL}
          onValueChange={(value) => {
            apply({ type: value });
          }}
        >
          <TabsList>
            <TabsTrigger value={ALL}>همه</TabsTrigger>
            {TRANSACTION_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {TRANSACTION_TYPE_LABELS[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <SearchField
          defaultValue={get("search")}
          onSubmit={(value) => {
            apply({ search: value });
          }}
        />

        <Button
          variant={showAdvanced ? "secondary" : "ghost"}
          onClick={() => {
            setShowAdvanced((open) => !open);
          }}
          aria-expanded={showAdvanced}
        >
          <SlidersHorizontal />
          فیلترها
          {activeCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-caption text-primary-foreground">
              {activeCount.toLocaleString("fa-IR")}
            </span>
          ) : null}
        </Button>

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            onClick={() => {
              router.push(pathname);
            }}
          >
            <X />
            پاک کردن
          </Button>
        ) : null}

        <span className="ms-auto text-caption text-muted-foreground">
          {total.toLocaleString("fa-IR")} تراکنش
        </span>
      </div>

      {showAdvanced ? (
        <div className="grid gap-4 rounded-lg bg-primary-subtle p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="حساب">
            <Select
              value={get("accountId") || ALL}
              onValueChange={(value) => {
                apply({ accountId: value });
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه حساب‌ها</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {owners.enabled ? (
            <Field label="مالک">
              <Select
                value={get("owner") || ALL}
                onValueChange={(value) => {
                  apply({ owner: value });
                }}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>همه</SelectItem>
                  {owners.options.map(({ value: owner }) => (
                    <SelectItem key={owner} value={owner}>
                      {owners.label(owner)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field label="دسته‌بندی">
            <Select
              value={get("categoryId") || ALL}
              onValueChange={(value) => {
                apply({ categoryId: value });
              }}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه</SelectItem>
                <SelectItem value={UNCATEGORISED}>بدون دسته</SelectItem>
                {categories.map((root) => (
                  <SelectGroup key={root.id}>
                    <SelectLabel>{root.name}</SelectLabel>
                    {[root, ...root.children].map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.parentId ? `— ${category.name}` : category.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="مبلغ (تومان)">
            <div className="flex gap-2" dir="ltr">
              <AmountFilter
                label="حداقل مبلغ"
                placeholder="از"
                initial={get("amountMin")}
                onCommit={(value) => {
                  apply({ amountMin: value });
                }}
              />
              <AmountFilter
                label="حداکثر مبلغ"
                placeholder="تا"
                initial={get("amountMax")}
                onCommit={(value) => {
                  apply({ amountMax: value });
                }}
              />
            </div>
          </Field>

          <Field label="از تاریخ" className="sm:col-span-2 lg:col-span-2">
            <Input
              type="date"
              className="h-9"
              defaultValue={get("dateFrom").slice(0, 10)}
              onChange={(event) => {
                apply({ dateFrom: event.target.value });
              }}
            />
          </Field>

          <Field label="تا تاریخ" className="sm:col-span-2 lg:col-span-2">
            <Input
              type="date"
              className="h-9"
              defaultValue={get("dateTo").slice(0, 10)}
              onChange={(event) => {
                apply({ dateTo: event.target.value });
              }}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 text-caption text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Search submits on Enter or blur rather than on every keystroke. */
function SearchField({
  defaultValue,
  onSubmit,
}: {
  defaultValue: string;
  onSubmit: (value: string) => void;
}) {
  return (
    <div className="relative min-w-48 flex-1 sm:max-w-64">
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="جستجو در توضیح…"
        aria-label="جستجو در تراکنش‌ها"
        className="ps-9"
        defaultValue={defaultValue}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit(event.currentTarget.value);
        }}
        onBlur={(event) => {
          if (event.target.value !== defaultValue) onSubmit(event.target.value);
        }}
      />
    </div>
  );
}

/**
 * One end of the amount range, grouped in threes like every amount field.
 * It applies on blur, as before; the URL gets the bare digits.
 */
function AmountFilter({
  label,
  placeholder,
  initial,
  onCommit,
}: {
  label: string;
  placeholder: string;
  initial: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = React.useState(initial);

  return (
    <MoneyInput
      aria-label={label}
      placeholder={placeholder}
      className="h-9"
      value={value}
      onChange={setValue}
      onBlur={() => {
        onCommit(value.replace(/,/g, ""));
      }}
    />
  );
}
