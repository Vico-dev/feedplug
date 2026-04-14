-- Configuration du scoring par canal (qualité + performance)
-- Voir backend-marketing/docs/SCORING_QUALITE_ET_PERF_CANAL.md

CREATE TABLE IF NOT EXISTS "channel_scoring_config" (
  "id" TEXT NOT NULL,
  "accountid" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "qualityweight" DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK ("qualityweight" >= 0 AND "qualityweight" <= 1),
  "performanceweight" DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK ("performanceweight" >= 0 AND "performanceweight" <= 1),
  "performancemetrics" JSONB DEFAULT '{}',
  "period" TEXT NOT NULL DEFAULT 'LAST_30_DAYS',
  "createdat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "channel_scoring_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_scoring_config_accountid_channel_key" ON "channel_scoring_config"("accountid", "channel");
CREATE INDEX "channel_scoring_config_accountid_idx" ON "channel_scoring_config"("accountid");
CREATE INDEX "channel_scoring_config_channel_idx" ON "channel_scoring_config"("channel");

ALTER TABLE "channel_scoring_config" ADD CONSTRAINT "channel_scoring_config_accountid_fkey"
  FOREIGN KEY ("accountid") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
