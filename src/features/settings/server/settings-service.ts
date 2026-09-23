import "server-only";

import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";

/**
 * What the deployment is and what it holds (tasks 8.12 and 8.22).
 *
 * Read-only, and deliberately so. Almost everything a household might expect
 * to "set" here is either fixed by what Finora is — Persian-first, RTL,
 * Toman, Asia/Tehran — or already settable where it is used: the theme in
 * the header, the owners on each record, the categories on their own page.
 * A settings screen that re-offered those would be a second place for them
 * to disagree.
 *
 * What is genuinely useful here is the opposite: a straight answer to "what
 * is this deployment configured as, and how much is in it", which is the
 * question a household asks before backing it up or moving it.
 */

export type DeploymentInfo = {
  locale: string;
  direction: string;
  timeZone: string;
  storageUnit: string;
  displayUnit: string;
  /** How many Rial make a Toman; the ratio every figure is displayed through. */
  rialPerToman: string;
};

export type DataSummary = {
  accounts: number;
  transactions: number;
  categories: number;
  assets: number;
  loans: number;
  recurringPayments: number;
  budgets: number;
  goals: number;
  /** The earliest and latest transaction, so a backup can be dated. */
  firstTransaction: string | null;
  lastTransaction: string | null;
};

export function getDeploymentInfo(): DeploymentInfo {
  return {
    locale: siteConfig.locale,
    direction: siteConfig.direction,
    timeZone: siteConfig.timeZone,
    storageUnit: siteConfig.currency.storageUnit,
    displayUnit: siteConfig.currency.displayUnit,
    rialPerToman: siteConfig.currency.rialPerToman.toString(),
  };
}

/** One round trip: nine counts and the two dates, in a single transaction. */
export async function getDataSummary(): Promise<DataSummary> {
  const [
    accounts,
    transactions,
    categories,
    assets,
    loans,
    recurringPayments,
    budgets,
    goals,
    first,
    last,
  ] = await prisma.$transaction([
    prisma.account.count(),
    prisma.transaction.count(),
    prisma.category.count(),
    prisma.asset.count(),
    prisma.loan.count(),
    prisma.recurringPayment.count(),
    prisma.budget.count(),
    prisma.goal.count(),
    prisma.transaction.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
    prisma.transaction.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);

  return {
    accounts,
    transactions,
    categories,
    assets,
    loans,
    recurringPayments,
    budgets,
    goals,
    firstTransaction: first?.date.toISOString() ?? null,
    lastTransaction: last?.date.toISOString() ?? null,
  };
}
