"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer, Download, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fromAbsoluteJalaliMonth, jalaliMonthLabel } from "@/utils/date";
import { OWNERS, OWNER_LABELS, type AccountDto } from "@/features/accounts/types";
import type { CategoryTreeNode } from "@/features/categories/types";
import type { ReportsDto } from "@/features/reports/types";

const ANY = "__all__";

function monthOptions(current: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const month = current - index;
    const { year, month: monthOfYear } = fromAbsoluteJalaliMonth(month);

    return { month, label: jalaliMonthLabel({ year, month: monthOfYear }) };
  });
}

/**
 * The filters every report shares (task 8.9).
 *
 * They live in the URL rather than in component state, for three reasons:
 * a filtered report is linkable, the browser's back button does what it
 * looks like it does, and the export downloads exactly what is on screen
 * because it reads the same query string.
 */
export function ReportFilterBar({
  reports,
  currentMonth,
  accounts,
  categories,
}: {
  reports: ReportsDto;
  currentMonth: number;
  accounts: AccountDto[];
  categories: CategoryTreeNode[];
}) {
  const router = useRouter();

  function apply(changes: Record<string, string | null>) {
    const params = new URLSearchParams();
    const state: Record<string, string | null> = {
      from: String(reports.from.month),
      to: String(reports.to.month),
      owner: reports.filters.owner,
      accountId: reports.filters.accountId,
      categoryId: reports.filters.categoryId,
      ...changes,
    };

    for (const [key, value] of Object.entries(state)) {
      if (value !== null && value !== ANY) params.set(key, value);
    }

    const query = params.toString();
    router.push(query ? `/reports?${query}` : "/reports");
  }

  // Two Jalali years back, which is the longest range the report will draw.
  const months = monthOptions(currentMonth, 24);
  const flatCategories = categories.flatMap((root) => [
    { id: root.id, label: root.name },
    ...root.children.map((child) => ({
      id: child.id,
      label: `${root.name} › ${child.name}`,
    })),
  ]);

  const query = new URLSearchParams();
  query.set("from", String(reports.from.month));
  query.set("to", String(reports.to.month));
  if (reports.filters.owner) query.set("owner", reports.filters.owner);
  if (reports.filters.accountId) query.set("accountId", reports.filters.accountId);
  if (reports.filters.categoryId) query.set("categoryId", reports.filters.categoryId);

  return (
    <Card variant="featured" className="gap-4 print:hidden">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="report-from">از ماه</Label>
          <Select
            value={String(reports.from.month)}
            onValueChange={(value) => {
              apply({ from: value });
            }}
          >
            <SelectTrigger id="report-from">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((option) => (
                <SelectItem key={option.month} value={String(option.month)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="report-to">تا ماه</Label>
          <Select
            value={String(reports.to.month)}
            onValueChange={(value) => {
              apply({ to: value });
            }}
          >
            <SelectTrigger id="report-to">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((option) => (
                <SelectItem key={option.month} value={String(option.month)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="report-owner">مالک</Label>
          <Select
            value={reports.filters.owner ?? ANY}
            onValueChange={(value) => {
              apply({ owner: value === ANY ? null : value });
            }}
          >
            <SelectTrigger id="report-owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              {OWNERS.map((owner) => (
                <SelectItem key={owner} value={owner}>
                  {OWNER_LABELS[owner]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="report-account">حساب</Label>
          <Select
            value={reports.filters.accountId ?? ANY}
            onValueChange={(value) => {
              apply({ accountId: value === ANY ? null : value });
            }}
          >
            <SelectTrigger id="report-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="report-category">دسته‌بندی</Label>
          <Select
            value={reports.filters.categoryId ?? ANY}
            onValueChange={(value) => {
              apply({ categoryId: value === ANY ? null : value });
            }}
          >
            <SelectTrigger id="report-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>همه</SelectItem>
              {flatCategories.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" asChild>
          {/*
            A plain link, so the browser downloads it: the export is the same
            query string the page is showing, which is what makes "export what
            I am looking at" true rather than approximately true.
          */}
          <a href={`/api/reports/export?${query.toString()}`} download>
            <Download />
            خروجی CSV
          </a>
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            window.print();
          }}
        >
          <Printer />
          چاپ / PDF
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            router.push("/reports");
          }}
        >
          <RotateCcw />
          بازنشانی
        </Button>
      </div>
    </Card>
  );
}
