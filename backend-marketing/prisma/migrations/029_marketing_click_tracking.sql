ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS marketingclickcount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lastmarketingclickat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lastmarketingclicktarget TEXT;

CREATE INDEX IF NOT EXISTS marketing_leads_lastmarketingclickat_idx ON marketing_leads(lastmarketingclickat);
