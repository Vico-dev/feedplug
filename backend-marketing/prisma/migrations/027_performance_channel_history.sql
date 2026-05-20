-- Historique des métriques de performance par canal (pour graphiques d'évolution)
-- Une ligne par (produit, canal, période, jour). Rétention 90 jours + job de purge.
-- Voir docs/PERFORMANCE_DATA_DEEP_DIVE.md §6
--
-- Note : colonnes en lowercase (cohérent avec le runtime, cf. performance/write-perf.js).

CREATE TABLE IF NOT EXISTS "PerformanceChannelHistory" (
  id            TEXT PRIMARY KEY,
  scoreid       TEXT NOT NULL REFERENCES "ProductScore"(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('GOOGLE_ADS','META_ADS','AMAZON','MIRAKL','SHOPIFY','OTHER')),
  period        TEXT NOT NULL,
  date          DATE NOT NULL,
  metrics       JSONB NOT NULL,
  channelscore  INTEGER NOT NULL DEFAULT 0 CHECK (channelscore >= 0 AND channelscore <= 100),
  createdat     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfhistory_unique
  ON "PerformanceChannelHistory" (scoreid, channel, period, date);

CREATE INDEX IF NOT EXISTS idx_perfhistory_scoreid ON "PerformanceChannelHistory"(scoreid);
CREATE INDEX IF NOT EXISTS idx_perfhistory_channel ON "PerformanceChannelHistory"(channel);
CREATE INDEX IF NOT EXISTS idx_perfhistory_date ON "PerformanceChannelHistory"(date);

COMMENT ON TABLE "PerformanceChannelHistory" IS 'Métriques de performance par canal et par jour. Rétention 90 jours (purge quotidienne).';
