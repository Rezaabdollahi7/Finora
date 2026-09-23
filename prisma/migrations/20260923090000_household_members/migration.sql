-- Household members become data instead of a fixed enum.
--
-- Until now the household was hard-wired as two named people plus "shared".
-- Anyone who clones Finora is somebody else, so the people are now rows in
-- `members`, and every `owner` column holds either 'SHARED' or a member id.
--
-- Existing rows keep their owners: the enum values 'REZA' and 'YEGANEH' are
-- carried over as text, and a member with that id is created for each one
-- that is actually in use, under the name the application used to show. The
-- household can rename them afterwards. A fresh database gets no members.

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- AlterTable: enum -> text, keeping every value. The budgets default is
-- dropped first because it is typed as the enum.
ALTER TABLE "budgets" ALTER COLUMN "owner" DROP DEFAULT;

ALTER TABLE "accounts" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;
ALTER TABLE "transactions" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;
ALTER TABLE "assets" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;
ALTER TABLE "loans" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;
ALTER TABLE "recurring_payments" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;
ALTER TABLE "budgets" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;
ALTER TABLE "goals" ALTER COLUMN "owner" SET DATA TYPE TEXT USING "owner"::text;

ALTER TABLE "budgets" ALTER COLUMN "owner" SET DEFAULT 'SHARED';

-- DropEnum
DROP TYPE "Owner";

-- Carry the two former people over, only where they own something.
INSERT INTO "members" ("id", "name", "createdAt", "updatedAt")
SELECT legacy.id, legacy.name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES ('REZA', 'رضا', 1), ('YEGANEH', 'یگانه', 2)) AS legacy (id, name, position)
WHERE EXISTS (
  SELECT 1 FROM "accounts" WHERE "owner" = legacy.id
  UNION ALL SELECT 1 FROM "transactions" WHERE "owner" = legacy.id
  UNION ALL SELECT 1 FROM "assets" WHERE "owner" = legacy.id
  UNION ALL SELECT 1 FROM "loans" WHERE "owner" = legacy.id
  UNION ALL SELECT 1 FROM "recurring_payments" WHERE "owner" = legacy.id
  UNION ALL SELECT 1 FROM "budgets" WHERE "owner" = legacy.id
  UNION ALL SELECT 1 FROM "goals" WHERE "owner" = legacy.id
)
ORDER BY legacy.position;
