-- Table ExportChannel : canaux d'export par plateforme (ex. Amazon FR, UK, DE, IT, ES)
CREATE TABLE IF NOT EXISTS "ExportChannel" (
  id          TEXT PRIMARY KEY,
  accountid   TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  channelkey  TEXT NOT NULL,
  label       TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  isactive    BOOLEAN NOT NULL DEFAULT true,
  createdat   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_exportchannel_account_platform_key
  ON "ExportChannel"(accountid, platform, channelkey);
CREATE INDEX IF NOT EXISTS idx_exportchannel_account ON "ExportChannel"(accountid);
CREATE INDEX IF NOT EXISTS idx_exportchannel_platform ON "ExportChannel"(platform);

COMMENT ON TABLE "ExportChannel" IS 'Canaux d''export (ex. Amazon FR, UK, DE, IT, ES) par compte';
