import { prisma } from "@/lib/prisma";

/**
 * Empty the database between integration suites.
 *
 * One function rather than a delete sequence copied into every test file.
 * The order matters — a RESTRICT foreign key refuses to delete a row another
 * table still points at — and getting it wrong produces a failure that
 * depends on which suite happened to run first, which is the worst kind to
 * debug.
 *
 * That is not hypothetical: adding loans in Sprint 4 gave Account a second
 * dependent, and every suite that cleared accounts without clearing loans
 * became order-dependent overnight. Keeping the order in one place means the
 * next model is one line here instead of nine edits.
 *
 * Deletes run from the most dependent table to the least. The ordering rule
 * is simple: anything holding a RESTRICT reference goes before the table it
 * points at.
 *
 *   {installment, recurring occurrence}   hold transactions
 *   {loan, recurring payment, budget}     hold categories and accounts
 *   transaction                           holds categories and accounts
 *   {asset valuation, asset}
 *   {category, account}
 */
export async function resetLedger(): Promise<void> {
  await prisma.installment.deleteMany();
  await prisma.recurringOccurrence.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.recurringPayment.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.assetValuation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
}
