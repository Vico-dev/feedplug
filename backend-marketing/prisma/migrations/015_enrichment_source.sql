-- Sources secondaires d'enrichissement : fusion de données externes (Excel, CSV) avec le flux principal
-- Permet custom labels, LIA, marges, etc. - mapping libre selon besoins client

CREATE TABLE IF NOT EXISTS "EnrichmentSource" (
  id              TEXT PRIMARY KEY,
  feedid          TEXT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  configjson      JSONB NOT NULL DEFAULT '{}',
  mappingjson     JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ERROR')),
  lastsyncat      TIMESTAMPTZ,
  accountid      TEXT NOT NULL DEFAULT 'default-account',
  createdat       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- configjson: { csvUrl, gcsPath?, joinKey, joinColumn }
--   joinKey: champ du FeedItem pour matcher (originId, sku, mpn, etc.)
--   joinColumn: colonne du fichier secondaire contenant la clé
-- mappingjson: { targetField: sourceColumn } ex: { "custom_label_0": "label_marketing", "margin": "marge" }

CREATE INDEX IF NOT EXISTS idx_enrichmentsource_feedid ON "EnrichmentSource"(feedid);
CREATE INDEX IF NOT EXISTS idx_enrichmentsource_status ON "EnrichmentSource"(status);
CREATE INDEX IF NOT EXISTS idx_enrichmentsource_accountid ON "EnrichmentSource"(accountid);
