-- Migration 014 : Moteur de règles, historisation (révisions), édition en masse
-- Réf. backend-marketing/docs/PLAN_MOTEUR_REGLES_EDITION_MASSE.md

-- 1. Table Rule (règles configurables)
CREATE TABLE IF NOT EXISTS "Rule" (
  id              TEXT PRIMARY KEY,
  accountid       TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  conditionjson   JSONB NOT NULL DEFAULT '{}',
  actionjson      JSONB NOT NULL DEFAULT '{}',
  feedids         JSONB NOT NULL DEFAULT '[]',
  channelids      JSONB NOT NULL DEFAULT '[]',
  startdate       TIMESTAMPTZ,
  enddate         TIMESTAMPTZ,
  runoningestion  BOOLEAN NOT NULL DEFAULT true,
  priority        INT NOT NULL DEFAULT 0,
  isactive        BOOLEAN NOT NULL DEFAULT true,
  createdat       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_accountid ON "Rule"(accountid);
CREATE INDEX IF NOT EXISTS idx_rule_isactive ON "Rule"(isactive);
CREATE INDEX IF NOT EXISTS idx_rule_dates ON "Rule"(startdate, enddate);

COMMENT ON TABLE "Rule" IS 'Règles métier : condition + action, scope flux/canaux, dates optionnelles';

-- 2. Table FeedItemRevision (historique des modifications par item)
CREATE TABLE IF NOT EXISTS "FeedItemRevision" (
  id            TEXT PRIMARY KEY,
  feeditemid    TEXT NOT NULL REFERENCES "FeedItem"(id) ON DELETE CASCADE,
  snapshotjson  JSONB NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('ingestion', 'rule', 'bulk_edit', 'manual', 'restore')),
  operationid   TEXT,
  createdat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feeditemrevision_feeditemid ON "FeedItemRevision"(feeditemid);
CREATE INDEX IF NOT EXISTS idx_feeditemrevision_createdat ON "FeedItemRevision"(createdat);
CREATE INDEX IF NOT EXISTS idx_feeditemrevision_operationid ON "FeedItemRevision"(operationid);
CREATE INDEX IF NOT EXISTS idx_feeditemrevision_source ON "FeedItemRevision"(source);

COMMENT ON TABLE "FeedItemRevision" IS 'Snapshot des champs modifiables avant chaque modification (rollback, retour au flux)';

-- 3. Table BulkEditOperation (opération d''édition en masse)
CREATE TABLE IF NOT EXISTS "BulkEditOperation" (
  id            TEXT PRIMARY KEY,
  accountid     TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  feedid       TEXT REFERENCES "Feed"(id) ON DELETE SET NULL,
  changesjson  JSONB NOT NULL,
  itemcount    INT NOT NULL DEFAULT 0,
  createdat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulkeditoperation_accountid ON "BulkEditOperation"(accountid);
CREATE INDEX IF NOT EXISTS idx_bulkeditoperation_createdat ON "BulkEditOperation"(createdat);

COMMENT ON TABLE "BulkEditOperation" IS 'Trace des éditions en masse pour annulation globale';

-- 4. Seed canal GMC pour les comptes existants (un canal par compte)
INSERT INTO "ExportChannel" (id, accountid, platform, channelkey, label, config, isactive, createdat, updatedat)
SELECT 
  'gmc-' || a.id,
  a.id,
  'gmc',
  'gmc',
  'Google Merchant Center',
  '{}',
  true,
  NOW(),
  NOW()
FROM "Account" a
WHERE NOT EXISTS (
  SELECT 1 FROM "ExportChannel" e 
  WHERE e.accountid = a.id AND e.platform = 'gmc' AND e.channelkey = 'gmc'
);
