import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  RecurringOccurrenceModel,
  RecurringPaymentModel,
} from "@/generated/prisma/models";
import { AppRuleError, ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { fromJalaliDate, toJalaliDate } from "@/utils/date";
import { sumRial } from "@/utils/money";
import {
  nextOccurrenceOnOrAfter,
  occurrenceStatus,
  occurrencesBetween,
  type RecurrenceRule,
} from "@/features/recurring/recurrence";
import type {
  CreateRecurringPaymentInput,
  PayOccurrenceInput,
  RecurringFilters,
  UpdateRecurringPaymentInput,
} from "@/features/recurring/schemas";
import type {
  OccurrenceDto,
  RecurringPaymentDetailDto,
  RecurringPaymentDto,
} from "@/features/recurring/types";

/**
 * Recurring payment data access and business rules (tasks 5.3–5.5).
 *
 * The rule engine in `recurrence.ts` has no database and is tested on its
 * own; this file is what joins it to the rows that exist.
 *
 * The shape to keep in mind: **an expected payment is not a row.** It is a
 * date the rule produces. Paying one writes a row, and from then on that
 * date reads from the row rather than from the rule — which is what stops an
 * edited rule from rewriting what was already paid (rule G.4).
 */

type PaymentRow = RecurringPaymentModel & {
  occurrences: RecurringOccurrenceModel[];
  category: { name: string } | null;
  account: { name: string } | null;
};

const withRelations = {
  occurrences: { orderBy: { dueDate: "asc" } },
  category: { select: { name: true } },
  account: { select: { name: true } },
} satisfies Prisma.RecurringPaymentInclude;

/** The rule a row describes. */
function ruleOf(payment: RecurringPaymentModel): RecurrenceRule {
  return {
    frequency: payment.frequency,
    interval: payment.interval,
    startDate: payment.startDate,
    endDate: payment.endDate,
    paymentDay: payment.paymentDay,
  };
}

/** The Jalali day an instant falls on, as that day's own midnight. */
function dayKey(instant: Date): string {
  return fromJalaliDate(toJalaliDate(instant)).toISOString();
}

/* -------------------------------------------------------------------------
 * DTOs
 * ---------------------------------------------------------------------- */

function toDto(payment: PaymentRow, now: Date): RecurringPaymentDto {
  const paid = payment.occurrences;

  // The next date still owed is the soonest the rule produces that has not
  // been paid. A month paid early does not make next month's date wrong, so
  // this walks forward from the last payment rather than from today.
  const paidDays = new Set(paid.map((row) => dayKey(row.dueDate)));
  let next = payment.isActive ? nextDueDate(payment, now, paidDays) : null;

  if (!payment.isActive) next = null;

  return {
    id: payment.id,
    name: payment.name,
    amount: payment.amount.toString(),
    frequency: payment.frequency,
    interval: payment.interval,
    startDate: payment.startDate.toISOString(),
    endDate: payment.endDate?.toISOString() ?? null,
    paymentDay: payment.paymentDay,
    categoryId: payment.categoryId,
    categoryName: payment.category?.name ?? null,
    accountId: payment.accountId,
    accountName: payment.account?.name ?? null,
    owner: payment.owner,
    isActive: payment.isActive,
    notes: payment.notes,
    nextDueDate: next?.toISOString() ?? null,
    nextStatus: next ? occurrenceStatus({ dueDate: next, paidAt: null }, now) : null,
    paidCount: paid.length,
    paidTotal: sumRial(paid.map((row) => row.amount)).toString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

/**
 * The soonest date the rule still owes.
 *
 * Starts from the rule's own beginning rather than from today, because an
 * occurrence that was never paid stays owed: a rent missed in Mordad is
 * still the next thing to settle in Shahrivar. Bounded by walking forward
 * only until an unpaid date is found or the rule runs out.
 */
function nextDueDate(
  payment: RecurringPaymentModel,
  now: Date,
  paidDays: Set<string>,
): Date | null {
  const rule = ruleOf(payment);
  let cursor = payment.startDate;

  // A rule that has produced many paid occurrences needs a few steps; the
  // cap stops a pathological rule from spinning.
  for (let step = 0; step < 500; step += 1) {
    const candidate = nextOccurrenceOnOrAfter(rule, cursor);
    if (!candidate) return null;

    if (!paidDays.has(dayKey(candidate))) return candidate;

    cursor = new Date(candidate.getTime() + 86_400_000);
  }

  // Past the cap, fall back to the next date from today rather than lying
  // about there being none.
  return nextOccurrenceOnOrAfter(rule, now);
}

/**
 * Every occurrence in a window — the paid rows and the dates still expected.
 *
 * A date with a row reads from the row; every other date the rule produces
 * is expected. That is the whole of task 5.3 in one function: the future is
 * a projection, and only the past that actually happened is stored.
 */
export function occurrencesIn(
  payment: PaymentRow,
  window: { start: Date; end: Date },
  now: Date,
): OccurrenceDto[] {
  const paidByDay = new Map(
    payment.occurrences.map((row) => [dayKey(row.dueDate), row]),
  );

  const expected = payment.isActive ? occurrencesBetween(ruleOf(payment), window) : [];

  const dates = new Map<string, Date>();

  for (const date of expected) dates.set(dayKey(date), date);

  // A paid occurrence stays visible even if the rule no longer produces its
  // date — an edited rule must not make a real payment disappear (G.4).
  for (const row of payment.occurrences) {
    if (row.dueDate >= window.start && row.dueDate < window.end) {
      dates.set(dayKey(row.dueDate), row.dueDate);
    }
  }

  return [...dates.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, date]) => {
      const row = paidByDay.get(key);

      return {
        id: row?.id ?? null,
        recurringPaymentId: payment.id,
        name: payment.name,
        dueDate: date.toISOString(),
        amount: (row?.amount ?? payment.amount).toString(),
        status: occurrenceStatus({ dueDate: date, paidAt: row?.paidAt ?? null }, now),
        paidAt: row?.paidAt.toISOString() ?? null,
        paidTransactionId: row?.paidTransactionId ?? null,
      };
    });
}

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

export async function listRecurringPayments(
  filters: RecurringFilters,
  now: Date = new Date(),
): Promise<RecurringPaymentDto[]> {
  const payments = await prisma.recurringPayment.findMany({
    where: {
      ...(filters.includeInactive ? {} : { isActive: true }),
      ...(filters.owner ? { owner: filters.owner } : {}),
    },
    include: withRelations,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return payments.map((payment) => toDto(payment, now));
}

/** A rule with the occurrences either side of today. */
export async function getRecurringPayment(
  id: string,
  now: Date = new Date(),
  window?: { start: Date; end: Date },
): Promise<RecurringPaymentDetailDto | null> {
  const payment = await prisma.recurringPayment.findUnique({
    where: { id },
    include: withRelations,
  });

  if (!payment) return null;

  // Six months back and a year forward: enough to show what was missed and
  // what is coming without projecting a rule to the end of time.
  const span = window ?? {
    start: new Date(now.getTime() - 180 * 86_400_000),
    end: new Date(now.getTime() + 365 * 86_400_000),
  };

  return { ...toDto(payment, now), occurrences: occurrencesIn(payment, span, now) };
}

/* -------------------------------------------------------------------------
 * Writes (task 5.5)
 * ---------------------------------------------------------------------- */

export async function createRecurringPayment(
  input: CreateRecurringPaymentInput,
  now: Date = new Date(),
): Promise<RecurringPaymentDetailDto> {
  const payment = await prisma.recurringPayment.create({
    data: {
      name: input.name,
      amount: input.amount,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate,
      // Only a monthly rule has a payment day; the rest take the start
      // date's, so storing one would be a field nothing reads.
      paymentDay: input.frequency === "MONTHLY" ? input.paymentDay : null,
      categoryId: input.categoryId,
      accountId: input.accountId,
      owner: input.owner,
      notes: input.notes,
    },
  });

  return (await getRecurringPayment(payment.id, now))!;
}

/**
 * Edit a rule.
 *
 * Changing the schedule changes only what is still expected. The occurrences
 * already paid are rows, with the date and the amount they actually had, and
 * nothing here touches them (rule G.4) — a rent that went up in Mehr did not
 * retroactively cost more in Mordad.
 */
export async function updateRecurringPayment(
  id: string,
  input: UpdateRecurringPaymentInput,
  now: Date = new Date(),
): Promise<RecurringPaymentDetailDto> {
  const existing = await requirePayment(id);

  const frequency = input.frequency ?? existing.frequency;

  await prisma.recurringPayment.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.amount === undefined ? {} : { amount: input.amount }),
      ...(input.frequency === undefined ? {} : { frequency: input.frequency }),
      ...(input.interval === undefined ? {} : { interval: input.interval }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      ...(input.endDate === undefined ? {} : { endDate: input.endDate }),
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.accountId === undefined ? {} : { accountId: input.accountId }),
      ...(input.owner === undefined ? {} : { owner: input.owner }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      ...(input.paymentDay === undefined && input.frequency === undefined
        ? {}
        : {
            paymentDay:
              frequency === "MONTHLY"
                ? (input.paymentDay ?? existing.paymentDay)
                : null,
          }),
    },
  });

  return (await getRecurringPayment(id, now))!;
}

/**
 * Switch a rule off.
 *
 * Rules are never deleted: the expenses their payments created are real
 * transactions in the ledger, and removing the rule would leave them
 * unexplained (rule G.4). An inactive rule stops producing expected payments
 * and keeps everything already paid.
 */
export async function setRecurringPaymentActive(
  id: string,
  isActive: boolean,
  now: Date = new Date(),
): Promise<RecurringPaymentDetailDto> {
  const existing = await requirePayment(id);

  if (existing.isActive === isActive) {
    throw new ConflictError(
      isActive ? "این پرداخت از قبل فعال است." : "این پرداخت از قبل غیرفعال است.",
      isActive ? "ALREADY_ACTIVE" : "ALREADY_INACTIVE",
    );
  }

  await prisma.recurringPayment.update({ where: { id }, data: { isActive } });

  return (await getRecurringPayment(id, now))!;
}

/* -------------------------------------------------------------------------
 * Paying (task 5.4)
 * ---------------------------------------------------------------------- */

/**
 * Turn an expected occurrence into a real expense.
 *
 * `Expected → Paid`, which is where a projection becomes a record. The
 * expense and the occurrence are written in one database transaction, so
 * there is no window in which money has left an account without the rule
 * knowing, or the reverse.
 *
 * The due date is checked against the rule rather than trusted. Without it a
 * request could pay a date the rule never produces, and the occurrence would
 * sit in the history attached to nothing.
 */
export async function payOccurrence(
  id: string,
  input: PayOccurrenceInput,
  now: Date = new Date(),
): Promise<RecurringPaymentDetailDto> {
  const payment = await requirePayment(id);

  if (!payment.isActive) {
    throw new ConflictError(
      "برای پرداخت غیرفعال نمی‌توان قسط ثبت کرد.",
      "PAYMENT_INACTIVE",
    );
  }

  const dueDate = assertRuleProduces(payment, input.dueDate);

  if (payment.occurrences.some((row) => dayKey(row.dueDate) === dayKey(dueDate))) {
    throw new ConflictError("این پرداخت قبلاً ثبت شده است.", "ALREADY_PAID");
  }

  const accountId = input.accountId ?? payment.accountId;

  if (!accountId) {
    throw new AppRuleError(
      "حساب پرداخت را انتخاب کنید یا برای این پرداخت یک حساب پیش‌فرض تعیین کنید.",
      "NO_PAYMENT_ACCOUNT",
      422,
    );
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } });

  if (!account) throw new NotFoundError("حساب پرداخت پیدا نشد.");

  if (!account.isActive) {
    throw new ConflictError(
      "از حساب بایگانی‌شده نمی‌توان پرداخت کرد.",
      "ACCOUNT_ARCHIVED",
    );
  }

  const amount = input.amount ?? payment.amount;
  // Defaults to the day it was due rather than to today: a rent paid on its
  // own date is the common case, and dating it now would move the expense
  // into whichever month the user happened to open the app.
  const paidAt = input.paidAt ?? dueDate;

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        type: "EXPENSE",
        amount,
        accountId,
        categoryId: payment.categoryId,
        owner: payment.owner,
        description: input.note ?? payment.name,
        date: paidAt,
      },
    });

    await tx.recurringOccurrence.create({
      data: {
        recurringPaymentId: id,
        dueDate,
        amount,
        paidAt,
        paidTransactionId: transaction.id,
      },
    });
  });

  return (await getRecurringPayment(id, now))!;
}

/**
 * Undo a payment.
 *
 * The same reasoning as undoing a loan instalment: the expense cannot be
 * deleted from the transactions page on its own, so without this a
 * mis-click would be permanent.
 */
export async function unpayOccurrence(
  id: string,
  dueDate: Date,
  now: Date = new Date(),
): Promise<RecurringPaymentDetailDto> {
  const payment = await requirePayment(id);
  const key = dayKey(dueDate);
  const row = payment.occurrences.find((entry) => dayKey(entry.dueDate) === key);

  if (!row) throw new NotFoundError("این پرداخت ثبت نشده است.");

  await prisma.$transaction(async (tx) => {
    // The occurrence goes first: the foreign key refuses to delete a
    // transaction an occurrence still points at.
    await tx.recurringOccurrence.delete({ where: { id: row.id } });
    await tx.transaction.delete({ where: { id: row.paidTransactionId } });
  });

  return (await getRecurringPayment(id, now))!;
}

/**
 * The rule's own date nearest the one asked for, or a refusal.
 *
 * Matching by Jalali day rather than by instant, so a request carrying a
 * timestamp from a browser in another zone still resolves to the right day.
 */
function assertRuleProduces(payment: RecurringPaymentModel, wanted: Date): Date {
  const key = dayKey(wanted);

  const window = {
    start: new Date(wanted.getTime() - 2 * 86_400_000),
    end: new Date(wanted.getTime() + 2 * 86_400_000),
  };

  const match = occurrencesBetween(ruleOf(payment), window).find(
    (date) => dayKey(date) === key,
  );

  if (!match) {
    throw new AppRuleError(
      "این تاریخ جزو سررسیدهای این پرداخت نیست.",
      "NOT_AN_OCCURRENCE",
      422,
    );
  }

  return match;
}

async function requirePayment(id: string): Promise<PaymentRow> {
  const payment = await prisma.recurringPayment.findUnique({
    where: { id },
    include: withRelations,
  });

  if (!payment) throw new NotFoundError("پرداخت دوره‌ای پیدا نشد.");

  return payment;
}

/* -------------------------------------------------------------------------
 * For other features
 * ---------------------------------------------------------------------- */

/**
 * Every occurrence of every active rule in a window (task 4.7).
 *
 * What the calendar and the upcoming timeline read. Two queries regardless of
 * how many rules there are: the rules with their paid rows, then nothing
 * else — the expected dates are computed, not fetched.
 */
export async function occurrencesForWindow(
  window: { start: Date; end: Date },
  now: Date = new Date(),
): Promise<OccurrenceDto[]> {
  const payments = await prisma.recurringPayment.findMany({
    where: {
      isActive: true,
      startDate: { lt: window.end },
      OR: [{ endDate: null }, { endDate: { gte: window.start } }],
    },
    include: withRelations,
  });

  return payments
    .flatMap((payment) => occurrencesIn(payment, window, now))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Whether a transaction was created by paying a recurring payment.
 *
 * The transactions feature asks before letting one be edited or deleted.
 */
export async function occurrenceForTransaction(
  transactionId: string,
): Promise<{ name: string } | null> {
  const row = await prisma.recurringOccurrence.findUnique({
    where: { paidTransactionId: transactionId },
    select: { recurringPayment: { select: { name: true } } },
  });

  return row ? { name: row.recurringPayment.name } : null;
}
