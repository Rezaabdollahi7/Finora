-- DropIndex
DROP INDEX "budgets_categoryId_fromMonth_idx";

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "owner" "Owner" NOT NULL DEFAULT 'SHARED';

-- CreateIndex
CREATE INDEX "budgets_categoryId_owner_fromMonth_idx" ON "budgets"("categoryId", "owner", "fromMonth");

-- The "one open window" rule is now per category **and owner**: the
-- household and each person may each budget the same category at the same
-- time, and before this the second one would be rejected as a duplicate.
-- Prisma does not manage this index (it is partial), so it is dropped and
-- recreated by hand, as it was created.
DROP INDEX "budgets_one_open_window_per_category";

CREATE UNIQUE INDEX "budgets_one_open_window_per_category_owner"
  ON "budgets" ("categoryId", "owner") WHERE "toMonth" IS NULL;
