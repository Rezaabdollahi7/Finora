import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { InstallmentModel, LoanModel } from "@/generated/prisma/models";
import { AppRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { loanProgress } from "@/features/loans/progress";
import {
  buildSchedule,
  installmentStatus,
  scheduleEndDate,
} from "@/features/loans/schedule";
import {
  SCHEDULE_FIELDS,
  type CreateLoanInput,
  type LoanFilters,
  type PayInstallmentInput,
  type UpdateLoanInput,
} from "@/features/loans/schemas";
import type { InstallmentDto, LoanDetailDto, LoanDto } from "@/features/loans/types";
import { assertOwner } from "@/features/members/server/member-service";

/**
 * Loan data access and business rules (tasks 4.2 and 4.4).
 *
 * Everything that reads or writes a loan goes through here. The arithmetic
 * lives in `schedule.ts` and `progress.ts`, which have no database and are
 * tested on their own (rule G.11).
 *
 * Two rules shape this file:
 *
 *   **Nothing already paid is ever rewritten.** Editing a loan regenerates
 *   only the instalments still owed; the paid ones keep the date and the
 *   amount they were actually paid at (rule G.4).
 *
 *   **Paying is one atomic act.** The expense, the instalment and the loan's
 *   status move together or not at all, so there is no window in which the
 *   money has left an account without the schedule knowing.
 */

type LoanRow = LoanModel & {
  installments: InstallmentModel[];
  category: { name: string } | null;
  account: { name: string } | null;
};

const withRelations = {
  installments: { orderBy: { number: "asc" } },
  category: { select: { name: true } },
  account: { select: { name: true } },
} satisfies Prisma.LoanInclude;

/* -------------------------------------------------------------------------
 * DTOs
 * ---------------------------------------------------------------------- */

function toInstallmentDto(row: InstallmentModel, now: Date): InstallmentDto {
  return {
    id: row.id,
    loanId: row.loanId,
    number: row.number,
    dueDate: row.dueDate.toISOString(),
    amount: row.amount.toString(),
    status: installmentStatus(row, now),
    paidAt: row.paidAt?.toISOString() ?? null,
    paidTransactionId: row.paidTransactionId,
  };
}

function toDto(loan: LoanRow, now: Date): LoanDto {
  return {
    id: loan.id,
    name: loan.name,
    provider: loan.provider,
    principalAmount: loan.principalAmount.toString(),
    interestRate: loan.interestRate,
    installmentAmount: loan.installmentAmount.toString(),
    installmentCount: loan.installmentCount,
    startDate: loan.startDate.toISOString(),
    endDate: loan.endDate.toISOString(),
    paymentDay: loan.paymentDay,
    owner: loan.owner,
    status: loan.status,
    categoryId: loan.categoryId,
    categoryName: loan.category?.name ?? null,
    accountId: loan.accountId,
    accountName: loan.account?.name ?? null,
    notes: loan.notes,
    progress: loanProgress(loan.installments, now),
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}

function toDetailDto(loan: LoanRow, now: Date): LoanDetailDto {
  return {
    ...toDto(loan, now),
    installments: loan.installments.map((row) => toInstallmentDto(row, now)),
  };
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

export async function listLoans(
  filters: LoanFilters,
  now: Date = new Date(),
): Promise<LoanDto[]> {
  const loans = await prisma.loan.findMany({
    where: {
      ...(filters.status
        ? { status: filters.status }
        : filters.includeArchived
          ? {}
          : { status: { not: "ARCHIVED" } }),
      ...(filters.owner ? { owner: filters.owner } : {}),
    },
    include: withRelations,
    // Live loans first, then the ones finishing soonest — which is the order
    // a household reads them in.
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
  });

  return loans.map((loan) => toDto(loan, now));
}

export async function getLoan(
  id: string,
  now: Date = new Date(),
): Promise<LoanDetailDto | null> {
  const loan = await prisma.loan.findUnique({ where: { id }, include: withRelations });
  return loan ? toDetailDto(loan, now) : null;
}

/* -------------------------------------------------------------------------
 * Create (tasks 4.2, 4.3)
 * ---------------------------------------------------------------------- */

/**
 * Create a loan and its whole schedule in one go.
 *
 * The instalments are generated here rather than on demand because they are
 * records, not a projection: each one can be paid, and a paid instalment has
 * a date and an amount of its own that no later recalculation may touch.
 */
export async function createLoan(
  input: CreateLoanInput,
  now: Date = new Date(),
): Promise<LoanDetailDto> {
  await assertOwner(input.owner);
  const schedule = buildSchedule(input);
  const endDate = scheduleEndDate(schedule);

  if (!endDate) {
    throw new AppRuleError("وام باید حداقل یک قسط داشته باشد.", "EMPTY_SCHEDULE", 422);
  }

  const loan = await prisma.loan.create({
    data: {
      name: input.name,
      provider: input.provider,
      principalAmount: input.principalAmount,
      interestRate: input.interestRate,
      installmentAmount: input.installmentAmount,
      installmentCount: input.installmentCount,
      startDate: input.startDate,
      endDate,
      paymentDay: input.paymentDay,
      owner: input.owner,
      categoryId: input.categoryId,
      accountId: input.accountId,
      notes: input.notes,
      installments: { create: schedule },
    },
    include: withRelations,
  });

  return toDetailDto(loan, now);
}

/* -------------------------------------------------------------------------
 * Update (task 4.2)
 * ---------------------------------------------------------------------- */

/**
 * Edit a loan.
 *
 * Changing anything the schedule is built from regenerates the instalments
 * that are still owed and leaves every paid one exactly as it is (rule G.4).
 * A household that renegotiates its instalment does not thereby change what
 * it already handed over.
 *
 * Shortening a loan below an instalment that has been paid is refused rather
 * than resolved: deleting a paid instalment would orphan a real expense, and
 * guessing which one the user meant to drop is worse than asking.
 */
export async function updateLoan(
  id: string,
  input: UpdateLoanInput,
  now: Date = new Date(),
): Promise<LoanDetailDto> {
  if (input.owner !== undefined) await assertOwner(input.owner);
  const existing = await requireLoan(id);

  if (existing.status === "ARCHIVED") {
    throw new ConflictError(
      "وام بایگانی‌شده قابل ویرایش نیست. ابتدا آن را از بایگانی خارج کنید.",
      "LOAN_ARCHIVED",
    );
  }

  const touchesSchedule = SCHEDULE_FIELDS.some((field) => input[field] !== undefined);

  const next = {
    installmentAmount: input.installmentAmount ?? existing.installmentAmount,
    installmentCount: input.installmentCount ?? existing.installmentCount,
    startDate: input.startDate ?? existing.startDate,
    paymentDay: input.paymentDay ?? existing.paymentDay,
  };

  const paid = existing.installments.filter((row) => row.paidAt !== null);

  if (touchesSchedule) {
    const highestPaid = paid.reduce((max, row) => Math.max(max, row.number), 0);

    if (next.installmentCount < highestPaid) {
      throw new ConflictError(
        `این وام ${highestPaid.toLocaleString("fa-IR")} قسط پرداخت‌شده دارد و تعداد اقساط نمی‌تواند کمتر از آن باشد.`,
        "PAID_BEYOND_NEW_COUNT",
      );
    }
  }

  const schedule = buildSchedule(next);
  const endDate = scheduleEndDate(schedule);

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.provider === undefined ? {} : { provider: input.provider }),
        ...(input.owner === undefined ? {} : { owner: input.owner }),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
        ...(input.principalAmount === undefined
          ? {}
          : { principalAmount: input.principalAmount }),
        ...(input.interestRate === undefined
          ? {}
          : { interestRate: input.interestRate }),
        ...(touchesSchedule ? { ...next, ...(endDate ? { endDate } : {}) } : {}),
      },
    });

    if (!touchesSchedule) return;

    const paidNumbers = new Set(paid.map((row) => row.number));

    // Only the unpaid ones go. A paid instalment keeps the due date and the
    // amount it was actually paid at, because that is what happened.
    await tx.installment.deleteMany({ where: { loanId: id, paidAt: null } });

    await tx.installment.createMany({
      data: schedule
        .filter((entry) => !paidNumbers.has(entry.number))
        .map((entry) => ({ ...entry, loanId: id })),
    });

    await syncStatus(tx, id);
  });

  return (await getLoan(id, now))!;
}

/* -------------------------------------------------------------------------
 * Archive (task 4.2)
 * ---------------------------------------------------------------------- */

/**
 * Archive a loan.
 *
 * Loans are never deleted: the expenses their payments created are real
 * transactions in the ledger, and removing the loan would leave them
 * unexplained (rule G.4). An archived loan keeps its whole schedule and
 * stops appearing in the calendar and the upcoming list.
 */
export async function archiveLoan(
  id: string,
  now: Date = new Date(),
): Promise<LoanDetailDto> {
  const existing = await requireLoan(id);

  if (existing.status === "ARCHIVED") {
    throw new ConflictError("این وام از قبل بایگانی شده است.", "ALREADY_ARCHIVED");
  }

  await prisma.loan.update({ where: { id }, data: { status: "ARCHIVED" } });
  return (await getLoan(id, now))!;
}

export async function restoreLoan(
  id: string,
  now: Date = new Date(),
): Promise<LoanDetailDto> {
  const existing = await requireLoan(id);

  if (existing.status !== "ARCHIVED") {
    throw new ConflictError("این وام بایگانی نشده است.", "ALREADY_ACTIVE");
  }

  await prisma.$transaction(async (tx) => {
    // Leave the archive first. syncStatus deliberately refuses to touch an
    // archived loan — archiving is a decision, not a consequence of the
    // numbers — so calling it while the row still said ARCHIVED would do
    // nothing at all.
    await tx.loan.update({ where: { id }, data: { status: "ACTIVE" } });

    // Then to ACTIVE or SETTLED depending on what is actually owed, rather
    // than to whatever it happened to be before it was archived.
    await syncStatus(tx, id);
  });

  return (await getLoan(id, now))!;
}

/* -------------------------------------------------------------------------
 * Payment (task 4.4)
 * ---------------------------------------------------------------------- */

/**
 * Mark an instalment paid, and record the expense it was paid with.
 *
 * One database transaction covers the expense, the instalment and the loan's
 * status, so there is no window in which money has left an account without
 * the schedule knowing, or the reverse.
 *
 * A second payment is refused three times over: here, by the instalment's
 * own `paidAt`, and — if both of those were somehow bypassed — by the unique
 * index on the transaction and the CHECK constraint that a paid instalment
 * carries both a date and a transaction.
 */
export async function payInstallment(
  loanId: string,
  number: number,
  input: PayInstallmentInput,
  now: Date = new Date(),
): Promise<LoanDetailDto> {
  const loan = await requireLoan(loanId);

  if (loan.status === "ARCHIVED") {
    throw new ConflictError(
      "برای وام بایگانی‌شده نمی‌توان قسط پرداخت کرد.",
      "LOAN_ARCHIVED",
    );
  }

  const installment = loan.installments.find((row) => row.number === number);

  if (!installment) throw new NotFoundError("این قسط پیدا نشد.");

  if (installment.paidAt) {
    throw new ConflictError("این قسط قبلاً پرداخت شده است.", "ALREADY_PAID");
  }

  const accountId = input.accountId ?? loan.accountId;

  if (!accountId) {
    throw new AppRuleError(
      "حساب پرداخت را انتخاب کنید یا برای وام یک حساب پیش‌فرض تعیین کنید.",
      "NO_PAYMENT_ACCOUNT",
      422,
    );
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });

  if (!account) throw new NotFoundError("حساب پرداخت پیدا نشد.");

  if (!account.isActive) {
    throw new ConflictError(
      "از حساب بایگانی‌شده نمی‌توان قسط پرداخت کرد.",
      "ACCOUNT_ARCHIVED",
    );
  }

  const paidAt = input.paidAt ?? now;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: "EXPENSE",
        amount: installment.amount,
        accountId,
        categoryId: loan.categoryId,
        owner: loan.owner,
        // A loan payment is an expense, not a transfer: the money leaves the
        // household rather than moving inside it (rule G.3).
        description:
          input.note ??
          `قسط ${number.toLocaleString("fa-IR")} از ${loan.installmentCount.toLocaleString("fa-IR")} — ${loan.name}`,
        date: paidAt,
      },
    });

    // The where clause repeats `paidAt: null`, so two requests racing for the
    // same instalment cannot both win: the second updates nothing.
    const { count } = await tx.installment.updateMany({
      where: { id: installment.id, paidAt: null },
      data: { paidAt, paidTransactionId: transaction.id },
    });

    if (count === 0) {
      throw new ConflictError("این قسط قبلاً پرداخت شده است.", "ALREADY_PAID");
    }

    await syncStatus(tx, loanId);
  });

  return (await getLoan(loanId, now))!;
}

/**
 * Undo a payment.
 *
 * Not in the roadmap, but the roadmap asks for duplicate payments to be
 * prevented, which means a wrong one has to be correctable. Without this the
 * only way back would be deleting the expense from the transactions page,
 * and the foreign key refuses that — correctly, since it would leave an
 * instalment claiming to be paid by a transaction that no longer exists.
 */
export async function unpayInstallment(
  loanId: string,
  number: number,
  now: Date = new Date(),
): Promise<LoanDetailDto> {
  const loan = await requireLoan(loanId);
  const installment = loan.installments.find((row) => row.number === number);

  if (!installment) throw new NotFoundError("این قسط پیدا نشد.");

  if (!installment.paidAt) {
    throw new ConflictError("این قسط پرداخت نشده است.", "NOT_PAID");
  }

  const transactionId = installment.paidTransactionId;

  await prisma.$transaction(async (tx) => {
    // Clear the link first: the foreign key refuses to delete a transaction
    // an instalment still points at.
    await tx.installment.update({
      where: { id: installment.id },
      data: { paidAt: null, paidTransactionId: null },
    });

    if (transactionId) {
      await tx.transaction.delete({ where: { id: transactionId } });
    }

    await syncStatus(tx, loanId);
  });

  return (await getLoan(loanId, now))!;
}

/* -------------------------------------------------------------------------
 * Status
 * ---------------------------------------------------------------------- */

/**
 * Bring the stored status back in line with the instalments.
 *
 * `status` is the schema's one denormalisation, so this runs inside every
 * transaction that can change what is owed — paying, undoing a payment,
 * regenerating a schedule, leaving the archive. An archived loan keeps its
 * archived status; that is a decision the household made, not a consequence
 * of the numbers.
 */
async function syncStatus(tx: Prisma.TransactionClient, loanId: string): Promise<void> {
  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    select: { status: true, installments: { select: { paidAt: true } } },
  });

  if (!loan || loan.status === "ARCHIVED") return;

  const settled =
    loan.installments.length > 0 &&
    loan.installments.every((installment) => installment.paidAt !== null);

  const next = settled ? "SETTLED" : "ACTIVE";

  if (next !== loan.status) {
    await tx.loan.update({ where: { id: loanId }, data: { status: next } });
  }
}

async function requireLoan(id: string): Promise<LoanRow> {
  const loan = await prisma.loan.findUnique({ where: { id }, include: withRelations });

  if (!loan) throw new NotFoundError("وام پیدا نشد.");

  return loan;
}

/* -------------------------------------------------------------------------
 * For other features
 * ---------------------------------------------------------------------- */

/**
 * Whether a transaction was created by paying an instalment.
 *
 * The transactions feature asks this before letting one be edited or
 * deleted: changing the amount of a loan payment behind the schedule's back
 * would leave the two disagreeing about what was paid.
 */
export async function installmentForTransaction(
  transactionId: string,
): Promise<{ loanId: string; loanName: string; number: number } | null> {
  const installment = await prisma.installment.findUnique({
    where: { paidTransactionId: transactionId },
    select: { number: true, loanId: true, loan: { select: { name: true } } },
  });

  if (!installment) return null;

  return {
    loanId: installment.loanId,
    loanName: installment.loan.name,
    number: installment.number,
  };
}
