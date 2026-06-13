-- Tests A/B : bras témoin (control) + variant, durée min, prérequis, restitution
-- Migration idempotente : peut être rejouée sans casser un état partiel
-- (types ou tables déjà créés par un run antérieur sont conservés).

DO $$ BEGIN
  CREATE TYPE "ABTestStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ABTestArm" AS ENUM ('CONTROL', 'VARIANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ab_test" (
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
  "updatedat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ab_test_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ab_test_assignment" (
  "id" TEXT NOT NULL,
  "testid" TEXT NOT NULL,
  "itemid" TEXT NOT NULL,
  "arm" "ABTestArm" NOT NULL,
  "variantvalue" TEXT,
  "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ab_test_assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ab_test_assignment_testid_itemid_key" ON "ab_test_assignment"("testid", "itemid");
CREATE INDEX IF NOT EXISTS "ab_test_accountid_idx" ON "ab_test"("accountid");
CREATE INDEX IF NOT EXISTS "ab_test_status_idx" ON "ab_test"("status");
CREATE INDEX IF NOT EXISTS "ab_test_platform_idx" ON "ab_test"("platform");
CREATE INDEX IF NOT EXISTS "ab_test_assignment_testid_idx" ON "ab_test_assignment"("testid");
CREATE INDEX IF NOT EXISTS "ab_test_assignment_itemid_idx" ON "ab_test_assignment"("itemid");

DO $$ BEGIN
  ALTER TABLE "ab_test" ADD CONSTRAINT "ab_test_accountid_fkey"
    FOREIGN KEY ("accountid") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ab_test_assignment" ADD CONSTRAINT "ab_test_assignment_testid_fkey"
    FOREIGN KEY ("testid") REFERENCES "ab_test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
