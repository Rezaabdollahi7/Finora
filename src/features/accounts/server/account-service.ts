import "server-only";

import type { AccountModel } from "@/generated/prisma/models";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  AccountFilters,
  CreateAccountInput,
  UpdateAccountInput,
} from "@/features/accounts/schemas";
import type { AccountDto } from "@/features/accounts/types";

/**
 * Account data access and business rules.
 *
 * Everything that reads or writes an account goes through here: the REST
 * handlers, the server components, and the tests. Keeping it in one place is
 * what makes the rules testable without a browser (rule G.11).
 */

/**
 * Every account's net movement and transaction count, in two queries
 * regardless of how many accounts there are.
 *
 * Grouping in the database rather than loading rows and summing in JavaScript
 * is what task 2.10 will ask for, and it is also the only way the totals stay
 * exact: Prisma returns a BigInt sum, so nothing passes through a float.
 */
async function loadAccountActivity(
  accountIds: readonly string[],
): Promise<Map<string, { delta: bigint; count: number }>> {
  const activity = new Map<string, { delta: bigint; count: number }>();

  if (accountIds.length === 0) return activity;

  const ids = [...accountIds];

  const bump = (id: string, delta: bigint, count: number) => {
    const current = activity.get(id) ?? { delta: 0n, count: 0 };
    activity.set(id, { delta: current.delta + delta, count: current.count + count });
  };

  // Income, expense, and transfers leaving each account.
  const outgoing = await prisma.transaction.groupBy({
    by: ["accountId", "type"],
    where: { accountId: { in: ids } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  for (const row of outgoing) {
    const amount = row._sum.amount ?? 0n;
    // INCOME credits the account; EXPENSE and an outgoing TRANSFER debit it.
    bump(row.accountId, row.type === "INCOME" ? amount : -amount, row._count._all);
  }

  // Transfers arriving into each account.
  const incoming = await prisma.transaction.groupBy({
    by: ["toAccountId"],
    where: { type: "TRANSFER", toAccountId: { in: ids } },
    _sum: { amount: true },
    _count: { _all: true },
  });

  for (const row of incoming) {
    if (!row.toAccountId) continue;
    bump(row.toAccountId, row._sum.amount ?? 0n, row._count._all);
  }

  return activity;
}

/**
 * Current balance, derived rather than stored.
 *
 * There is no balance column (see the schema comment on Account): a stored
 * balance becomes wrong the moment a transaction is edited or back-dated.
 */
function deriveBalance(account: AccountModel, delta: bigint): bigint {
  return account.initialBalance + delta;
}

function toDto(
  account: AccountModel,
  activity: { delta: bigint; count: number } | undefined,
): AccountDto {
  const delta = activity?.delta ?? 0n;

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    owner: account.owner,
    currency: account.currency,
    // bigint is serialised as a decimal string; see AccountDto.
    initialBalance: account.initialBalance.toString(),
    balance: deriveBalance(account, delta).toString(),
    transactionCount: activity?.count ?? 0,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

async function toDtos(accounts: AccountModel[]): Promise<AccountDto[]> {
  const activity = await loadAccountActivity(accounts.map((account) => account.id));
  return accounts.map((account) => toDto(account, activity.get(account.id)));
}

export async function listAccounts(filters: AccountFilters): Promise<AccountDto[]> {
  const accounts = await prisma.account.findMany({
    where: {
      ...(filters.includeArchived ? {} : { isActive: true }),
      ...(filters.owner ? { owner: filters.owner } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    },
    // Active first, then the most recently added — an archived account should
    // never sit above a live one in a list that shows both.
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return toDtos(accounts);
}

export async function getAccount(id: string): Promise<AccountDto | null> {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return null;

  const activity = await loadAccountActivity([account.id]);
  return toDto(account, activity.get(account.id));
}

export async function createAccount(input: CreateAccountInput): Promise<AccountDto> {
  const account = await prisma.account.create({
    data: {
      name: input.name,
      type: input.type,
      owner: input.owner,
      currency: input.currency,
      initialBalance: input.initialBalance,
    },
  });

  return toDto(account, undefined);
}

export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
): Promise<AccountDto> {
  const existing = await requireAccount(id);

  if (!existing.isActive) {
    throw new ConflictError(
      "حساب بایگانی‌شده قابل ویرایش نیست. ابتدا آن را از بایگانی خارج کنید.",
      "ACCOUNT_ARCHIVED",
    );
  }

  const account = await prisma.account.update({ where: { id }, data: input });
  const activity = await loadAccountActivity([id]);

  return toDto(account, activity.get(id));
}

/**
 * Archive an account.
 *
 * Accounts are never deleted. Financial history has to stay readable, and a
 * removed account would orphan or silently rewrite every transaction that
 * referenced it (rule G.4). Archiving hides it from active lists while
 * keeping everything it was part of intact.
 */
export async function archiveAccount(id: string): Promise<AccountDto> {
  const existing = await requireAccount(id);

  if (!existing.isActive) {
    throw new ConflictError("این حساب از قبل بایگانی شده است.", "ALREADY_ARCHIVED");
  }

  const account = await prisma.account.update({
    where: { id },
    data: { isActive: false },
  });
  const activity = await loadAccountActivity([id]);

  return toDto(account, activity.get(id));
}

export async function restoreAccount(id: string): Promise<AccountDto> {
  const existing = await requireAccount(id);

  if (existing.isActive) {
    throw new ConflictError("این حساب بایگانی نشده است.", "ALREADY_ACTIVE");
  }

  const account = await prisma.account.update({
    where: { id },
    data: { isActive: true },
  });
  const activity = await loadAccountActivity([id]);

  return toDto(account, activity.get(id));
}

async function requireAccount(id: string): Promise<AccountModel> {
  const account = await prisma.account.findUnique({ where: { id } });

  if (!account) {
    throw new NotFoundError("حساب پیدا نشد.");
  }

  return account;
}
