-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'YEARLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "recurring_payments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "interval" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "paymentDay" INTEGER,
    "categoryId" TEXT,
    "accountId" TEXT,
    "owner" "Owner" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_occurrences" (
    "id" TEXT NOT NULL,
    "recurringPaymentId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "paidTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "rollover" BOOLEAN NOT NULL DEFAULT false,
    "fromMonth" INTEGER NOT NULL,
    "toMonth" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_payments_isActive_idx" ON "recurring_payments"("isActive");

-- CreateIndex
CREATE INDEX "recurring_payments_owner_idx" ON "recurring_payments"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_paidTransactionId_key" ON "recurring_occurrences"("paidTransactionId");

-- CreateIndex
CREATE INDEX "recurring_occurrences_dueDate_idx" ON "recurring_occurrences"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_recurringPaymentId_dueDate_key" ON "recurring_occurrences"("recurringPaymentId", "dueDate");

-- CreateIndex
CREATE INDEX "budgets_categoryId_fromMonth_idx" ON "budgets"("categoryId", "fromMonth");

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "recurring_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_paidTransactionId_fkey" FOREIGN KEY ("paidTransactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants the API also enforces, restated here so no path can write a bad
-- row: not a migration, not a psql session, not a future feature that forgets.

-- A payment of nothing is not a payment.
ALTER TABLE "recurring_payments"
  ADD CONSTRAINT "recurring_payments_amount_positive" CHECK ("amount" > 0);

-- An interval of zero would ask the generator for an infinitely dense
-- sequence; the rule engine clamps it, but nothing should be able to store
-- it in the first place.
ALTER TABLE "recurring_payments"
  ADD CONSTRAINT "recurring_payments_interval_positive" CHECK ("interval" > 0);

-- The payment day is a day of the Jalali month. 31 is allowed and clamped to
-- the month's own length by the rule engine; 0 and 32 are not days.
ALTER TABLE "recurring_payments"
  ADD CONSTRAINT "recurring_payments_payment_day_in_month"
  CHECK ("paymentDay" IS NULL OR "paymentDay" BETWEEN 1 AND 31);

-- A rule that ends before it starts produces nothing and means nothing.
ALTER TABLE "recurring_payments"
  ADD CONSTRAINT "recurring_payments_ends_after_it_starts"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "recurring_occurrences"
  ADD CONSTRAINT "recurring_occurrences_amount_positive" CHECK ("amount" > 0);

-- A budget of zero is a real instruction — "spend nothing here" — so only a
-- negative one is rejected.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_amount_non_negative" CHECK ("amount" >= 0);

-- A window runs forward, and an open one has no end.
ALTER TABLE "budgets"
  ADD CONSTRAINT "budgets_window_runs_forward"
  CHECK ("toMonth" IS NULL OR "toMonth" >= "fromMonth");

-- A category has at most one open budget window. Two would make "the budget
-- in force this month" ambiguous, and the answer would depend on row order.
-- A partial index rather than a plain unique: the closed windows are the
-- history, and a category accumulates as many of those as it has had limits.
CREATE UNIQUE INDEX "budgets_one_open_window_per_category"
  ON "budgets" ("categoryId") WHERE "toMonth" IS NULL;
