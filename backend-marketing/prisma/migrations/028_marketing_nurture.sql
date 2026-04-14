ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS marketingoptin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resendcontactid TEXT,
  ADD COLUMN IF NOT EXISTS nurturestage TEXT DEFAULT 'pending_j0',
  ADD COLUMN IF NOT EXISTS lastmarketingemailat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nextmarketingemailat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribedat TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS marketing_leads_nurturestage_idx ON marketing_leads(nurturestage);
CREATE INDEX IF NOT EXISTS marketing_leads_nextmarketingemailat_idx ON marketing_leads(nextmarketingemailat);
