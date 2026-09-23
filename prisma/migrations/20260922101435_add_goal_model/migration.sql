-- CreateEnum
CREATE TYPE "GoalKind" AS ENUM ('EMERGENCY', 'PURCHASE', 'TRAVEL', 'INVESTMENT', 'EDUCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GoalKind" NOT NULL DEFAULT 'OTHER',
    "targetAmount" BIGINT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "owner" "Owner" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "icon" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "isWithdrawal" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_status_idx" ON "goals"("status");

-- CreateIndex
CREATE INDEX "goals_owner_idx" ON "goals"("owner");

-- CreateIndex
CREATE INDEX "goals_targetDate_idx" ON "goals"("targetDate");

-- CreateIndex
CREATE INDEX "goal_contributions_goalId_date_idx" ON "goal_contributions"("goalId", "date");

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A goal aims at something, so the target has to be more than nothing.
ALTER TABLE "goals"
  ADD CONSTRAINT "goals_target_positive" CHECK ("targetAmount" > 0);

-- The sign lives in `isWithdrawal`, never in the number (rule G.2), so a
-- negative amount here would mean the opposite of itself twice over.
ALTER TABLE "goal_contributions"
  ADD CONSTRAINT "goal_contributions_amount_positive" CHECK ("amount" > 0);
