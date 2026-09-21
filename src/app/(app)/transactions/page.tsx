import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/common/page-header";
import { requireNavItem } from "@/config/navigation";
import { accountFiltersSchema } from "@/features/accounts/schemas";
import { listAccounts } from "@/features/accounts/server/account-service";
import { categoryFiltersSchema } from "@/features/categories/schemas";
import { listCategoryTree } from "@/features/categories/server/category-service";
import { transactionFiltersSchema } from "@/features/transactions/schemas";
import { listTransactions } from "@/features/transactions/server/transaction-service";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import TransactionsLoading from "./loading";

const nav = requireNavItem("/transactions");

export const metadata: Metadata = { title: nav.label };

/** Reads the database on every request; see docs/ARCHITECTURE.md. */
export const dynamic = "force-dynamic";

const FILTER_KEYS = [
  "type",
  "accountId",
  "owner",
  "categoryId",
  "dateFrom",
  "dateTo",
  "amountMin",
  "amountMax",
  "search",
] as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TransactionsPage({ searchParams }: Props) {
  return (
    <div className="space-y-8">
      <PageHeader title={nav.label} description={nav.description} />
      <Suspense fallback={<TransactionsLoading />}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TransactionsContent({ searchParams }: Props) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  /*
   * Filters come from the URL and are applied in the database. A bad value in
   * a hand-edited query string falls back to the unfiltered list rather than
   * throwing an error page at the reader — the filter bar still shows what
   * was asked for, so the mismatch is visible.
   */
  const parsed = transactionFiltersSchema.safeParse({
    type: first("type"),
    accountId: first("accountId"),
    owner: first("owner"),
    categoryId: first("categoryId"),
    dateFrom: first("dateFrom"),
    dateTo: first("dateTo"),
    amountMin: first("amountMin"),
    amountMax: first("amountMax"),
    search: first("search"),
    page: first("page"),
    pageSize: first("pageSize"),
  });

  const filters = parsed.success ? parsed.data : transactionFiltersSchema.parse({});

  const [page, accounts, categories] = await Promise.all([
    listTransactions(filters),
    listAccounts(accountFiltersSchema.parse({ includeArchived: true })),
    listCategoryTree(categoryFiltersSchema.parse({})),
  ]);

  return (
    <TransactionList
      transactions={page.transactions}
      accounts={accounts}
      categories={categories}
      page={page.page}
      totalPages={page.totalPages}
      total={page.total}
      filtered={FILTER_KEYS.some((key) => first(key))}
    />
  );
}
