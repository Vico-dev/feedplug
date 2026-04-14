-- Migration pour l'historique des enrichissements
-- Créer la table EnrichmentHistory pour tracker les enrichissements

CREATE TABLE IF NOT EXISTS "EnrichmentHistory" (
  id              TEXT PRIMARY KEY,
  itemId          TEXT NOT NULL REFERENCES "FeedItem"(id) ON DELETE CASCADE,
  feedId          TEXT REFERENCES "Feed"(id) ON DELETE SET NULL,
  enrichedFields  JSONB NOT NULL, -- { "brand": "Nike", "color": "Bleu", ... }
  alerts          JSONB, -- [{ "field": "gtin", "level": "error", "message": "..." }]
  method          TEXT NOT NULL DEFAULT 'automatic', -- 'automatic', 'manual', 'ai', 'rules'
  aiProvider      TEXT, -- 'gemini', 'openai', etc. si méthode = 'ai'
  aiModel         TEXT, -- 'gemini-pro', 'gpt-4o-mini', etc.
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_itemid ON "EnrichmentHistory"(itemId);
CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_feedid ON "EnrichmentHistory"(feedId);
CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_createdat ON "EnrichmentHistory"(createdAt);
CREATE INDEX IF NOT EXISTS idx_enrichmenthistory_method ON "EnrichmentHistory"(method);

-- Table pour les statistiques d'enrichissement par feed
CREATE TABLE IF NOT EXISTS "EnrichmentStats" (
  id                    TEXT PRIMARY KEY,
  feedId                TEXT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  totalItems            INT NOT NULL DEFAULT 0,
  enrichedItems         INT NOT NULL DEFAULT 0,
  fieldsEnriched        INT NOT NULL DEFAULT 0, -- Total de champs enrichis
  alertsGenerated       INT NOT NULL DEFAULT 0,
  alertsResolved        INT NOT NULL DEFAULT 0,
  aiEnrichments         INT NOT NULL DEFAULT 0, -- Nombre d'enrichissements avec IA
  rulesEnrichments      INT NOT NULL DEFAULT 0, -- Nombre d'enrichissements avec règles
  createdAt             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(feedId, date)
);

CREATE INDEX IF NOT EXISTS idx_enrichmentstats_feedid ON "EnrichmentStats"(feedId);
CREATE INDEX IF NOT EXISTS idx_enrichmentstats_date ON "EnrichmentStats"(date);

