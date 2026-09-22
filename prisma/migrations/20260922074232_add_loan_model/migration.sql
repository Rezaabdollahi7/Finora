-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'SETTLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "principalAmount" BIGINT NOT NULL,
    "interestRate" INTEGER NOT NULL DEFAULT 0,
    "installmentAmount" BIGINT NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paymentDay" INTEGER NOT NULL,
    "owner" "Owner" NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT,
    "accountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loans_owner_idx" ON "loans"("owner");

-- CreateIndex
CREATE INDEX "loans_endDate_idx" ON "loans"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "installments_paidTransactionId_key" ON "installments"("paidTransactionId");

-- CreateIndex
CREATE INDEX "installments_dueDate_idx" ON "installments"("dueDate");

-- CreateIndex
CREATE INDEX "installments_loanId_dueDate_idx" ON "installments"("loanId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "installments_loanId_number_key" ON "installments"("loanId", "number");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_paidTransactionId_fkey" FOREIGN KEY ("paidTransactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Invariants the API also enforces, restated here so no path can write a bad
-- row: not a migration, not a psql session, not a future feature that forgets.

-- Money borrowed and money repaid are never negative; rule G.2 keeps
-- direction out of the number.
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_principal_non_negative" CHECK ("principalAmount" >= 0);

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_installment_amount_positive"
  CHECK ("installmentAmount" > 0);

-- A rate can be zero (an interest-free family loan) but not negative.
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_interest_rate_non_negative" CHECK ("interestRate" >= 0);

-- A loan with no instalments has no schedule and nothing to pay.
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_installment_count_positive"
  CHECK ("installmentCount" > 0);

-- The payment day is a day of the Jalali month. 31 is allowed and clamped to
-- the month's length by the schedule builder; 0 and 32 are not days.
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_payment_day_in_month"
  CHECK ("paymentDay" BETWEEN 1 AND 31);

-- The schedule runs forward.
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_ends_after_it_starts" CHECK ("endDate" >= "startDate");

ALTER TABLE "installments"
  ADD CONSTRAINT "installments_number_positive" CHECK ("number" > 0);

ALTER TABLE "installments"
  ADD CONSTRAINT "installments_amount_positive" CHECK ("amount" > 0);

-- A paid instalment has a payment date, and a payment date means it is paid.
-- Without this a row could carry a transaction with no date, which every
-- status calculation would read as still owed while the money had gone.
ALTER TABLE "installments"
  ADD CONSTRAINT "installments_paid_shape"
  CHECK (("paidAt" IS NULL) = ("paidTransactionId" IS NULL));
