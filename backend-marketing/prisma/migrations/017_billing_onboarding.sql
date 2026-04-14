-- Migration 017 : Billing B2B + Onboarding progress

-- Table Billing (infos facturation B2B)
CREATE TABLE IF NOT EXISTS "Billing" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  accountid       TEXT NOT NULL UNIQUE REFERENCES "Account"(id) ON DELETE CASCADE,
  companyname     TEXT NOT NULL,
  siret           TEXT,
  siren           TEXT,
  vatnumber       TEXT,
  addressline1    TEXT NOT NULL,
  addressline2    TEXT,
  postalcode      TEXT NOT NULL,
  city            TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'FR',
  billingemail    TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  createdat       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_accountid ON "Billing"(accountid);

-- Table OnboardingProgress (progression onboarding)
CREATE TABLE IF NOT EXISTS "OnboardingProgress" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  accountid       TEXT NOT NULL UNIQUE REFERENCES "Account"(id) ON DELETE CASCADE,
  currentstep     TEXT NOT NULL DEFAULT 'welcome',
  completedsteps  JSONB NOT NULL DEFAULT '[]',
  collecteddata   JSONB NOT NULL DEFAULT '{}',
  updatedat       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_accountid ON "OnboardingProgress"(accountid);
