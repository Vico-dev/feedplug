-- Migration pour ajouter le système de scoring

-- Créer l'enum PerformanceChannelType
DO $$ BEGIN
    CREATE TYPE "PerformanceChannelType" AS ENUM ('GOOGLE_ADS', 'META_ADS', 'AMAZON', 'MIRAKL', 'SHOPIFY', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Créer la table ProductScore
CREATE TABLE IF NOT EXISTS "ProductScore" (
  id                TEXT PRIMARY KEY,
  itemId            TEXT NOT NULL UNIQUE REFERENCES "FeedItem"(id) ON DELETE CASCADE,
  qualityScore      INTEGER NOT NULL DEFAULT 0 CHECK (qualityScore >= 0 AND qualityScore <= 100),
  performanceScore  INTEGER NOT NULL DEFAULT 0 CHECK (performanceScore >= 0 AND performanceScore <= 100),
  qualityDetails    JSONB,
  performanceDetails JSONB,
  updatedAt         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  createdAt         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productscore_itemid ON "ProductScore"(itemId);
CREATE INDEX IF NOT EXISTS idx_productscore_quality ON "ProductScore"(qualityScore);
CREATE INDEX IF NOT EXISTS idx_productscore_performance ON "ProductScore"(performanceScore);

-- Créer la table PerformanceChannel
CREATE TABLE IF NOT EXISTS "PerformanceChannel" (
  id            TEXT PRIMARY KEY,
  scoreId       TEXT NOT NULL REFERENCES "ProductScore"(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('GOOGLE_ADS', 'META_ADS', 'AMAZON', 'MIRAKL', 'SHOPIFY', 'OTHER')),
  metrics       JSONB NOT NULL,
  channelScore  INTEGER NOT NULL DEFAULT 0 CHECK (channelScore >= 0 AND channelScore <= 100),
  period        TEXT NOT NULL,
  date          TIMESTAMPTZ NOT NULL,
  createdAt     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performancechannel_scoreid ON "PerformanceChannel"(scoreId);
CREATE INDEX IF NOT EXISTS idx_performancechannel_channel ON "PerformanceChannel"(channel);
CREATE INDEX IF NOT EXISTS idx_performancechannel_date ON "PerformanceChannel"(date);






