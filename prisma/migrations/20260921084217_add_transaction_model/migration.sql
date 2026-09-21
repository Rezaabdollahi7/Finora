-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "categoryId" TEXT,
    "owner" "Owner" NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_accountId_date_idx" ON "transactions"("accountId", "date");

-- CreateIndex
CREATE INDEX "transactions_toAccountId_idx" ON "transactions"("toAccountId");

-- CreateIndex
CREATE INDEX "transactions_type_date_idx" ON "transactions"("type", "date");

-- CreateIndex
CREATE INDEX "transactions_owner_idx" ON "transactions"("owner");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants Prisma's schema language cannot express. Enforcing them in the
-- database means no code path — API, script, or psql session — can write a
-- row that breaks them.

-- The sign of a movement lives in `type`, never in the number (rule G.2).
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0);

-- A transfer needs a destination, and it must differ from the source: a
-- transfer to itself would net to zero while still inflating counts and
-- histories. Anything that is not a transfer must have no destination at all.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_transfer_shape" CHECK (
    ("type" = 'TRANSFER' AND "toAccountId" IS NOT NULL AND "toAccountId" <> "accountId")
    OR ("type" <> 'TRANSFER' AND "toAccountId" IS NULL)
  );

-- A transfer is not spending, so it is never categorised (rule G.3).
-- Allowing a category would let a transfer appear in an expense-by-category
-- report and double-count household spending.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_transfer_uncategorised" CHECK (
    "type" <> 'TRANSFER' OR "categoryId" IS NULL
  );
