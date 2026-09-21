import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  AccountModel,
  CategoryModel,
  TransactionModel,
} from "@/generated/prisma/models";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { formatToman } from "@/utils/money";
import { ACCOUNT_TYPE_LABELS } from "@/features/accounts/types";
import {
  affectedAccountIds,
  allowsNegativeBalance,
  balanceDelta,
  type Movement,
} from "@/features/transactions/balance";
import type {
  CreateTransactionInput,
  TransactionFilters,
  UpdateTransactionInput,
} from "@/features/transactions/schemas";
import type { TransactionDto } from "@/features/transactions/types";

/**
 * Transaction data access and business rules (tasks 1.5 and 1.6).
 *
 * Every write runs inside a database transaction that re-reads the affected
 * accounts and re-checks the resulting balances, so two concurrent requests
 * cannot each see enough money and both succeed.
 */

type WithAccounts = TransactionModel & {
  account: Pick<AccountModel, "name">;
  toAccount: Pick<AccountModel, "name"> | null;
  category: Pick<CategoryModel, "name" | "icon"> | null;
};

const withAccounts = {
  account: { select: { name: true } },
  toAccount: { select: { name: true } },
  category: { select: { name: true, icon: true } },
} satisfies Prisma.TransactionInclude;

function toDto(transaction: WithAccounts): TransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount.toString(),
    accountId: transaction.accountId,
    accountName: transaction.account.name,
    toAccountId: transaction.toAccountId,
    toAccountName: transaction.toAccount?.name ?? null,
    categoryId: transaction.categoryId,
    categoryName: transaction.category?.name ?? null,
    categoryIcon: transaction.category?.icon ?? null,
    owner: transaction.owner,
    description: transaction.description,
    date: transaction.date.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

function toMovement(input: CreateTransactionInput): Movement {
  return {
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
  };
}

/**
 * Check the accounts a write touches, inside the same database transaction.
 *
 * `previous` is the movement being replaced or removed, so an edit is scored
 * as "undo the old, apply the new" rather than as a second, additive write.
 */
async function assertAccountsAccept(
  tx: Prisma.TransactionClient,
  next: Movement | null,
  previous: Movement | null,
): Promise<void> {
  const touched = new Set<string>([
    ...(next ? affectedAccountIds(next) : []),
    ...(previous ? affectedAccountIds(previous) : []),
  ]);

  if (touched.size === 0) return;

  const accounts = await tx.account.findMany({ where: { id: { in: [...touched] } } });

  if (accounts.length !== touched.size) {
    throw new NotFoundError("حساب انتخاب‌شده پیدا نشد.");
  }

  for (const account of accounts) {
    // An archived account is out of play: it keeps its history but must not
    // gain new movements, in either direction.
    if (!account.isActive && next && affectedAccountIds(next).includes(account.id)) {
      throw new ConflictError(
        `حساب «${account.name}» بایگانی شده است و نمی‌تواند تراکنش جدید بگیرد.`,
        "ACCOUNT_ARCHIVED",
      );
    }

    if (allowsNegativeBalance(account.type)) continue;

    const current = await currentBalance(tx, account);
    const projected =
      current +
      (next ? balanceDelta(next, account.id) : 0n) -
      (previous ? balanceDelta(previous, account.id) : 0n);

    if (projected < 0n) {
      throw new ConflictError(
        `موجودی حساب «${account.name}» (${ACCOUNT_TYPE_LABELS[account.type]}) منفی می‌شود. ` +
          `موجودی فعلی ${formatToman(current)} است.`,
        "INSUFFICIENT_BALANCE",
      );
    }
  }
}

/**
 * A category must match the transaction it is filed under.
 *
 * An expense filed under an income category would land on the wrong side of
 * every report, and an archived category must not collect new transactions
 * even though it keeps the old ones (rule G.4). Transfers carry no category
 * at all, which the schema already rejects before reaching here.
 */
async function assertCategoryFits(
  tx: Prisma.TransactionClient,
  type: CreateTransactionInput["type"],
  categoryId: string | null,
): Promise<void> {
  if (!categoryId) return;

  const category = await tx.category.findUnique({ where: { id: categoryId } });

  if (!category) throw new NotFoundError("دسته‌بندی انتخاب‌شده پیدا نشد.");

  if (!category.isActive) {
    throw new ConflictError(
      `دسته «${category.name}» بایگانی شده است.`,
      "CATEGORY_ARCHIVED",
    );
  }

  const expected = type === "INCOME" ? "INCOME" : "EXPENSE";

  if (category.kind !== expected) {
    throw new ConflictError(
      `دسته «${category.name}» برای ${expected === "INCOME" ? "درآمد" : "هزینه"} نیست.`,
      "CATEGORY_KIND_MISMATCH",
    );
  }
}

/** One account's balance, read inside the caller's database transaction. */
async function currentBalance(
  tx: Prisma.TransactionClient,
  account: AccountModel,
): Promise<bigint> {
  const [outgoing, incoming] = await Promise.all([
    tx.transaction.groupBy({
      by: ["type"],
      where: { accountId: account.id },
      _sum: { amount: true },
    }),
    tx.transaction.aggregate({
      where: { type: "TRANSFER", toAccountId: account.id },
      _sum: { amount: true },
    }),
  ]);

  let balance = account.initialBalance;

  for (const row of outgoing) {
    const amount = row._sum.amount ?? 0n;
    balance += row.type === "INCOME" ? amount : -amount;
  }

  return balance + (incoming._sum.amount ?? 0n);
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<TransactionDto> {
  const created = await prisma.$transaction(async (tx) => {
    await assertAccountsAccept(tx, toMovement(input), null);
    await assertCategoryFits(tx, input.type, input.categoryId);

    return tx.transaction.create({
      data: {
        type: input.type,
        amount: input.amount,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        categoryId: input.categoryId,
        owner: input.owner,
        description: input.description,
        date: input.date,
      },
      include: withAccounts,
    });
  });

  return toDto(created);
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<TransactionDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("تراکنش پیدا نشد.");

    await assertAccountsAccept(tx, toMovement(input), {
      type: existing.type,
      amount: existing.amount,
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
    });
    await assertCategoryFits(tx, input.type, input.categoryId);

    return tx.transaction.update({
      where: { id },
      data: {
        type: input.type,
        amount: input.amount,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        categoryId: input.categoryId,
        owner: input.owner,
        description: input.description,
        date: input.date,
      },
      include: withAccounts,
    });
  });

  return toDto(updated);
}

/**
 * Delete a transaction.
 *
 * Unlike accounts, transactions are genuinely removed: a mistyped entry is
 * noise in every report until it is gone, and nothing references it. Removing
 * one can still push an account negative — deleting an income leaves the
 * expenses behind — so the same guard runs.
 */
export async function deleteTransaction(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("تراکنش پیدا نشد.");

    await assertAccountsAccept(tx, null, {
      type: existing.type,
      amount: existing.amount,
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
    });

    await tx.transaction.delete({ where: { id } });
  });
}

export async function getTransaction(id: string): Promise<TransactionDto | null> {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: withAccounts,
  });

  return transaction ? toDto(transaction) : null;
}

export type TransactionPage = {
  transactions: TransactionDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function listTransactions(
  filters: TransactionFilters,
): Promise<TransactionPage> {
  const where: Prisma.TransactionWhereInput = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.owner ? { owner: filters.owner } : {}),
    // An account's page should show transfers in as well as out.
    ...(filters.accountId
      ? {
          OR: [{ accountId: filters.accountId }, { toAccountId: filters.accountId }],
        }
      : {}),
    ...(filters.search
      ? { description: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: withAccounts,
      // Newest first, with the id as a tiebreaker so pagination is stable
      // when several transactions share a date — without it, rows can
      // reappear on the next page or be skipped entirely.
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    transactions: transactions.map(toDto),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
