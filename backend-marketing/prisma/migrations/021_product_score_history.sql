-- Historique du score qualité par produit (pour graphique d'évolution)
CREATE TABLE IF NOT EXISTS "ProductScoreHistory" (
  id           TEXT PRIMARY KEY,
  itemId       TEXT NOT NULL REFERENCES "FeedItem"(id) ON DELETE CASCADE,
  qualityScore INTEGER NOT NULL CHECK (qualityScore >= 0 AND qualityScore <= 100),
  recordedAt   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productscorehistory_itemid ON "ProductScoreHistory"(itemId);
CREATE INDEX IF NOT EXISTS idx_productscorehistory_recordedat ON "ProductScoreHistory"(recordedAt DESC);

COMMENT ON TABLE "ProductScoreHistory" IS 'Un point est enregistré à chaque changement de score (enrichissement, synchro, édition). Limité aux ~60 derniers points par item.';
