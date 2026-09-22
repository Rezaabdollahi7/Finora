import "server-only";

import type { BudgetModel } from "@/generated/prisma/models";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  absoluteJalaliMonth,
  fromAbsoluteJalaliMonth,
  jalaliMonthLabel,
  jalaliMonthOf,
  jalaliMonthRange,
} from "@/utils/date";
import { sumRial } from "@/utils/money";
import {
  budgetState,
  foldRollover,
  budgetAlerts,
  type BudgetMonth,
} from "@/features/budgets/tracking";
import type {
  BudgetAlertDto,
  BudgetHistoryPointDto,
  BudgetLineDto,
  BudgetMonthDto,
} from "@/features/budgets/types";
import type { ClearBudgetInput, SetBudgetInput } from "@/features/budgets/schemas";
import { getUpcomingObligations } from "@/features/calendar/server/calendar-service";
import { listAccounts } from "@/features/accounts/server/account-service";
import { accountFiltersSchema } from "@/features/accounts/schemas";

/**
 * Budget data access (tasks 5.6–5.10).
 *
 * The arithmetic is in `tracking.ts` and has no database; this file is what
 * joins it to the rows.
 *
 * A budget is stored as a **window**, not a value: `fromMonth`, an optional
 * `toMonth`, and the amount that applied between them. Raising the food
 * budget in Mehr closes the old window at Shahrivar and opens a new one, so
 * asking what the budget was in Mordad still answers with Mordad's figure
 * (rule G.4). A single mutable amount would rewrite every past month the
 * moment the household changed its mind.
 */

/**
 * How far back the rollover chain walks.
 *
 * A budget set two Jalali years ago should not cost two years of arithmetic
 * to display this month. Beyond this the carry is computed from the window's
 * last twenty-four months, which is far more history than a household's
 * "unused money" claim survives anyway.
 */
const MAX_ROLLOVER_MONTHS = 24;

/** A bound on the obligations the cash alert looks at; see `alertsFor`. */
const OBLIGATION_LIMIT = 200;

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  icon: string | null;
};

/* -------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------- */

/**
 * One month of budgets, in full.
 *
 * Four queries regardless of how many categories have budgets: the expense
 * categories, their budget windows, the expenses in the span the rollover
 * chain needs, and the accounts and obligations behind the cash alert.
 */
export async function getBudgetMonth(
  month?: number,
  now: Date = new Date(),
): Promise<BudgetMonthDto> {
  const target = month ?? absoluteJalaliMonth(jalaliMonthOf(now));

  const [categories, budgets] = await Promise.all([
    prisma.category.findMany({
      where: { kind: "EXPENSE" },
      select: { id: true, name: true, parentId: true, icon: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    // Every window that has ever been open for a category with one now: the
    // rollover chain reads months before the target.
    prisma.budget.findMany({ orderBy: { fromMonth: "asc" } }),
  ]);

  const byCategory = new Map<string, BudgetModel[]>();

  for (const budget of budgets) {
    const list = byCategory.get(budget.categoryId);
    if (list) list.push(budget);
    else byCategory.set(budget.categoryId, [budget]);
  }

  // Only categories with a window covering the target month have a line.
  const budgeted = categories
    .map((category) => ({
      category,
      budget: windowFor(byCategory.get(category.id) ?? [], target),
    }))
    .filter((entry): entry is { category: CategoryRow; budget: BudgetModel } =>
      Boolean(entry.budget),
    );

  const earliest = budgeted.reduce(
    (min, { budget }) =>
      Math.min(min, Math.max(budget.fromMonth, target - MAX_ROLLOVER_MONTHS)),
    target,
  );

  const spending = await spendingByCategoryMonth(earliest, target);
  const childrenOf = groupChildren(categories);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  const lines = budgeted.map(({ category, budget }) =>
    toLine(category, budget, {
      target,
      earliest,
      spending,
      childrenOf,
      parentName: category.parentId ? (nameById.get(category.parentId) ?? null) : null,
    }),
  );

  // A child's spending already counts inside its budgeted parent, so a total
  // that added both would charge the household twice for one dinner.
  const budgetedIds = new Set(lines.map((line) => line.categoryId));
  const topLevel = lines.filter((line) => {
    const parentId = budgeted.find((b) => b.category.id === line.categoryId)!.category
      .parentId;
    return parentId === null || !budgetedIds.has(parentId);
  });

  const totalAvailable = sumRial(topLevel.map((line) => BigInt(line.available)));
  const totalSpent = sumRial(topLevel.map((line) => BigInt(line.spent)));

  const { year, month: monthOfYear } = fromAbsoluteJalaliMonth(target);

  return {
    month: target,
    year,
    monthOfYear,
    label: jalaliMonthLabel({ year, month: monthOfYear }),
    lines,
    totals: {
      amount: sumRial(topLevel.map((line) => BigInt(line.amount))).toString(),
      available: totalAvailable.toString(),
      spent: totalSpent.toString(),
      remaining: (totalAvailable - totalSpent).toString(),
      ratio: ratioOfStrings(totalAvailable, totalSpent),
      state: budgetState(totalAvailable, totalSpent),
    },
    alerts: await alertsFor(lines, target, now),
  };
}

/** A category's budget across the months around one, for the history view. */
export async function getBudgetHistory(
  categoryId: string,
  end: number,
  count = 6,
): Promise<BudgetHistoryPointDto[]> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, parentId: true, icon: true },
  });

  if (!category) throw new NotFoundError("دسته‌بندی پیدا نشد.");

  const start = end - (count - 1);
  const [budgets, children] = await Promise.all([
    prisma.budget.findMany({ where: { categoryId }, orderBy: { fromMonth: "asc" } }),
    prisma.category.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    }),
  ]);

  const spending = await spendingByCategoryMonth(start, end);
  const ids = [categoryId, ...children.map((child) => child.id)];

  return Array.from({ length: count }, (_, index) => {
    const month = start + index;
    const budget = windowFor(budgets, month);
    const amount = budget?.amount ?? 0n;
    const spent = sumRial(ids.map((id) => spending.get(key(id, month)) ?? 0n));
    const { year, month: monthOfYear } = fromAbsoluteJalaliMonth(month);

    return {
      month,
      label: jalaliMonthLabel({ year, month: monthOfYear }, { withYear: false }),
      amount: amount.toString(),
      spent: spent.toString(),
      state: budgetState(amount, spent),
    };
  });
}

/* -------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------- */

/**
 * Set a category's budget from a month on.
 *
 * The months before it keep whatever they had: the window in force is closed
 * the month before, and a new one opens (rule G.4). Setting the same month
 * twice edits that window rather than stacking a second one on it.
 */
export async function setBudget(input: SetBudgetInput): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, kind: true },
  });

  if (!category) throw new NotFoundError("دسته‌بندی پیدا نشد.");

  const windows = await prisma.budget.findMany({
    where: { categoryId: input.categoryId },
    orderBy: { fromMonth: "asc" },
  });

  const covering = windowFor(windows, input.fromMonth);

  await prisma.$transaction(async (tx) => {
    if (covering?.fromMonth === input.fromMonth) {
      await tx.budget.update({
        where: { id: covering.id },
        data: { amount: input.amount, rollover: input.rollover },
      });
      return;
    }

    if (covering) {
      // The old window ends the month before the new one starts, and the new
      // one inherits whatever end the old one had.
      await tx.budget.update({
        where: { id: covering.id },
        data: { toMonth: input.fromMonth - 1 },
      });

      await tx.budget.create({
        data: {
          categoryId: input.categoryId,
          amount: input.amount,
          rollover: input.rollover,
          fromMonth: input.fromMonth,
          toMonth: covering.toMonth,
        },
      });
      return;
    }

    // No window covers the month. A later one may still exist — setting a
    // budget for a past month must not swallow the months after it.
    const next = windows.find((window) => window.fromMonth > input.fromMonth);

    await tx.budget.create({
      data: {
        categoryId: input.categoryId,
        amount: input.amount,
        rollover: input.rollover,
        fromMonth: input.fromMonth,
        toMonth: next ? next.fromMonth - 1 : null,
      },
    });
  });
}

/**
 * Stop budgeting a category from a month on.
 *
 * The months it did apply to keep their figures, so a report of Mordad still
 * shows the budget Mordad was measured against (rule G.4).
 */
export async function clearBudget(input: ClearBudgetInput): Promise<void> {
  const windows = await prisma.budget.findMany({
    where: { categoryId: input.categoryId },
    orderBy: { fromMonth: "asc" },
  });

  const covering = windowFor(windows, input.fromMonth);

  if (!covering) throw new NotFoundError("بودجه‌ای برای این ماه تنظیم نشده است.");

  await prisma.$transaction(async (tx) => {
    // A window that never applied to an earlier month has nothing to
    // preserve, so it goes rather than becoming an empty range.
    if (covering.fromMonth >= input.fromMonth) {
      await tx.budget.delete({ where: { id: covering.id } });
    } else {
      await tx.budget.update({
        where: { id: covering.id },
        data: { toMonth: input.fromMonth - 1 },
      });
    }

    // Anything starting later would silently come back into force.
    await tx.budget.deleteMany({
      where: { categoryId: input.categoryId, fromMonth: { gte: input.fromMonth } },
    });
  });
}

/* -------------------------------------------------------------------------
 * Internals
 * ---------------------------------------------------------------------- */

/** The window in force for a month, or undefined when none is. */
function windowFor(windows: BudgetModel[], month: number): BudgetModel | undefined {
  return windows.find(
    (window) =>
      window.fromMonth <= month && (window.toMonth === null || month <= window.toMonth),
  );
}

function key(categoryId: string, month: number): string {
  return `${categoryId}:${month}`;
}

/** Direct children by parent id. The tree is two levels deep at most. */
function groupChildren(categories: CategoryRow[]): Map<string, string[]> {
  const children = new Map<string, string[]>();

  for (const category of categories) {
    if (!category.parentId) continue;
    const list = children.get(category.parentId);
    if (list) list.push(category.id);
    else children.set(category.parentId, [category.id]);
  }

  return children;
}

/**
 * Expenses per category per Jalali month, over a run of months.
 *
 * One query rather than one per month. The bucketing happens here rather
 * than in SQL because the month is Jalali and the column is a UTC instant —
 * Postgres has no Persian calendar, and shipping one into a query would put
 * the boundary a few hours out twice a year.
 *
 * Transfers are not expenses (rule G.3) and are excluded by the type filter,
 * not by hoping none exist.
 */
async function spendingByCategoryMonth(
  from: number,
  to: number,
): Promise<Map<string, bigint>> {
  const start = jalaliMonthRange(fromAbsoluteJalaliMonth(from)).start;
  const end = jalaliMonthRange(fromAbsoluteJalaliMonth(to)).end;

  const rows = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      categoryId: { not: null },
      date: { gte: start, lt: end },
    },
    select: { categoryId: true, date: true, amount: true },
  });

  const spending = new Map<string, bigint>();

  for (const row of rows) {
    const mapKey = key(row.categoryId!, absoluteJalaliMonth(jalaliMonthOf(row.date)));
    spending.set(mapKey, (spending.get(mapKey) ?? 0n) + row.amount);
  }

  return spending;
}

function toLine(
  category: CategoryRow,
  budget: BudgetModel,
  context: {
    target: number;
    earliest: number;
    spending: Map<string, bigint>;
    childrenOf: Map<string, string[]>;
    parentName: string | null;
  },
): BudgetLineDto {
  // A parent's budget covers what its children spend: "food: 25M" means the
  // restaurants inside it too, or the limit would be trivially met by filing
  // every dinner one level down.
  const ids = [category.id, ...(context.childrenOf.get(category.id) ?? [])];

  // The chain starts where the window does, so a budget is not credited with
  // a surplus from months it did not apply to.
  const start = Math.max(budget.fromMonth, context.earliest);

  const months = [];

  for (let month = start; month <= context.target; month += 1) {
    months.push({
      month,
      amount: budget.amount,
      spent: sumRial(ids.map((id) => context.spending.get(key(id, month)) ?? 0n)),
    });
  }

  const folded = foldRollover(months, { rollover: budget.rollover });
  const current: BudgetMonth = folded[folded.length - 1]!;

  return {
    id: budget.id,
    categoryId: category.id,
    categoryName: category.name,
    parentName: context.parentName,
    icon: category.icon,
    amount: current.amount.toString(),
    carriedIn: current.carriedIn.toString(),
    available: current.available.toString(),
    spent: current.spent.toString(),
    remaining: current.remaining.toString(),
    ratio: current.ratio,
    state: current.state,
    rollover: budget.rollover,
  };
}

/** The same proportion `tracking.ts` computes, for the totals row. */
function ratioOfStrings(available: bigint, spent: bigint): number {
  return foldRollover([{ month: 0, amount: available, spent }], { rollover: false })[0]!
    .ratio;
}

/**
 * This month's alerts (task 5.10).
 *
 * The cash shortfall is deliberately not about budgets at all: a household
 * can be inside every budget it set and still not have the money for the
 * instalments falling due, and that is the more urgent of the two.
 */
async function alertsFor(
  lines: BudgetLineDto[],
  target: number,
  now: Date,
): Promise<BudgetAlertDto[]> {
  const { end } = jalaliMonthRange(fromAbsoluteJalaliMonth(target));

  const [accounts, obligations] = await Promise.all([
    listAccounts(accountFiltersSchema.parse({})),
    // The limit is a safety bound, not a page: obligations come back in date
    // order, so the ones inside a single month are always within the first
    // few. A household with two hundred payments due in one month has a
    // problem this alert is not going to be the one to find.
    getUpcomingObligations(OBLIGATION_LIMIT, now),
  ]);

  // Only what falls due inside the month being looked at; a payment two
  // months out is not a shortfall today.
  const due = obligations.filter((event) => new Date(event.date) < end);

  const availableBalance = sumRial(
    accounts
      .filter((account) => account.isActive)
      .map((account) => BigInt(account.balance)),
  );

  const alerts = budgetAlerts(
    lines.map((line) => ({
      categoryId: line.categoryId,
      categoryName: line.categoryName,
      month: {
        amount: BigInt(line.amount),
        carriedIn: BigInt(line.carriedIn),
        available: BigInt(line.available),
        spent: BigInt(line.spent),
        remaining: BigInt(line.remaining),
        ratio: line.ratio,
        state: line.state,
      },
    })),
    {
      availableBalance,
      upcomingObligations: sumRial(due.map((event) => BigInt(event.amount))),
    },
  );

  return alerts.map((alert) => ({ ...alert, amount: alert.amount.toString() }));
}
