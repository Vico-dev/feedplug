-- Tests A/B : bras témoin (control) + variant, durée min, prérequis, restitution
CREATE TYPE "ABTestStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ABTestArm" AS ENUM ('CONTROL', 'VARIANT');

CREATE TABLE "ab_test" (
  "id" TEXT NOT NULL,
  "accountid" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "feedid" TEXT,
  "fieldundertest" TEXT NOT NULL DEFAULT 'title',
  "platform" TEXT NOT NULL,
  "status" "ABTestStatus" NOT NULL DEFAULT 'DRAFT',
  "startdate" TIMESTAMP(3),
  "enddate" TIMESTAMP(3),
  "mindurationdays" INTEGER NOT NULL DEFAULT 14,
  "controlpercent" INTEGER NOT NULL DEFAULT 50,
  "variantpercent" INTEGER NOT NULL DEFAULT 50,
  "prerequisitesmet" BOOLEAN,
  "resultsummary" JSONB,
  "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedat" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ab_test_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ab_test_assignment" (
  "id" TEXT NOT NULL,
  "testid" TEXT NOT NULL,
  "itemid" TEXT NOT NULL,
  "arm" "ABTestArm" NOT NULL,
  "variantvalue" TEXT,
  "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ab_test_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ab_test_assignment_testid_itemid_key" ON "ab_test_assignment"("testid", "itemid");
CREATE INDEX "ab_test_accountid_idx" ON "ab_test"("accountid");
CREATE INDEX "ab_test_status_idx" ON "ab_test"("status");
CREATE INDEX "ab_test_platform_idx" ON "ab_test"("platform");
CREATE INDEX "ab_test_assignment_testid_idx" ON "ab_test_assignment"("testid");
CREATE INDEX "ab_test_assignment_itemid_idx" ON "ab_test_assignment"("itemid");

ALTER TABLE "ab_test" ADD CONSTRAINT "ab_test_accountid_fkey" FOREIGN KEY ("accountid") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ab_test_assignment" ADD CONSTRAINT "ab_test_assignment_testid_fkey" FOREIGN KEY ("testid") REFERENCES "ab_test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
