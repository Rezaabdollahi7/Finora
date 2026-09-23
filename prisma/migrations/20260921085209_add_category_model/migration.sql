-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "parentId" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_kind_isActive_idx" ON "categories"("kind", "isActive");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sibling names must be unique. Two partial indexes rather than one on
-- ("parentId", name), because PostgreSQL treats NULLs as distinct in a
-- unique index, so every top-level category would escape the constraint.
CREATE UNIQUE INDEX "categories_root_name_key"
  ON "categories" ("kind", "name") WHERE "parentId" IS NULL;

CREATE UNIQUE INDEX "categories_child_name_key"
  ON "categories" ("parentId", "name") WHERE "parentId" IS NOT NULL;

-- A category cannot be its own parent. Deeper cycles and the two-level
-- depth limit are enforced in the service, which can explain them; this
-- catches the one case a constraint can see on its own.
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_not_self_parent" CHECK ("parentId" IS DISTINCT FROM "id");
