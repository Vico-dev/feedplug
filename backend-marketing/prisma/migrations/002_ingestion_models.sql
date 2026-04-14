-- Ingestion models for product feeds

-- Enums simulated with CHECK constraints (Prisma will manage via text)

CREATE TABLE IF NOT EXISTS "Credential" (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  connector    TEXT NOT NULL CHECK (connector IN ('CSV','SHOPIFY','WOOCOMMERCE','SFCC','PRESTASHOP','ERP','PIM')),
  secretJson   JSONB NOT NULL,
  createdAt    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "FeedSource" (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  connector      TEXT NOT NULL CHECK (connector IN ('CSV','SHOPIFY','WOOCOMMERCE','SFCC','PRESTASHOP','ERP','PIM')),
  configJson     JSONB NOT NULL,
  defaultFreq    TEXT NOT NULL DEFAULT 'DAILY' CHECK (defaultFreq IN ('HOURLY','DAILY')),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ERROR')),
  lastRunAt      TIMESTAMPTZ,
  createdAt      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credentialId   TEXT REFERENCES "Credential"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedsource_connector ON "FeedSource"(connector);
CREATE INDEX IF NOT EXISTS idx_feedsource_status ON "FeedSource"(status);

CREATE TABLE IF NOT EXISTS "Feed" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sourceId        TEXT NOT NULL REFERENCES "FeedSource"(id) ON DELETE CASCADE,
  frequency       TEXT NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('HOURLY','DAILY')),
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','ERROR')),
  mappingJson     JSONB NOT NULL,
  dedupStrategy   TEXT NOT NULL DEFAULT 'guid_or_url',
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_sourceId ON "Feed"(sourceId);
CREATE INDEX IF NOT EXISTS idx_feed_status ON "Feed"(status);

CREATE TABLE IF NOT EXISTS "FeedItem" (
  id               TEXT PRIMARY KEY,
  feedId           TEXT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  originId         TEXT NOT NULL,
  url              TEXT,
  title            TEXT NOT NULL,
  descriptionHtml  TEXT,
  descriptionText  TEXT,
  imageUrl         TEXT,
  brand            TEXT,
  sku              TEXT,
  price            NUMERIC(18,4),
  currency         TEXT,
  inventory        INTEGER,
  publishedAt      TIMESTAMPTZ,
  updatedAt        TIMESTAMPTZ,
  contentHash      TEXT NOT NULL,
  createdAt        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_feeditem_feed_origin ON "FeedItem"(feedId, originId);
CREATE INDEX IF NOT EXISTS idx_feeditem_feedId ON "FeedItem"(feedId);
CREATE INDEX IF NOT EXISTS idx_feeditem_sku ON "FeedItem"(sku);
CREATE INDEX IF NOT EXISTS idx_feeditem_hash ON "FeedItem"(contentHash);

CREATE TABLE IF NOT EXISTS "IngestionRun" (
  id             TEXT PRIMARY KEY,
  feedId         TEXT NOT NULL REFERENCES "Feed"(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SUCCESS','PARTIAL','FAILED')),
  scheduledAt    TIMESTAMPTZ,
  startedAt      TIMESTAMPTZ,
  finishedAt     TIMESTAMPTZ,
  totalFetched   INTEGER NOT NULL DEFAULT 0,
  totalInserted  INTEGER NOT NULL DEFAULT 0,
  totalUpdated   INTEGER NOT NULL DEFAULT 0,
  totalSkipped   INTEGER NOT NULL DEFAULT 0,
  errorMessage   TEXT
);

CREATE INDEX IF NOT EXISTS idx_run_feedId ON "IngestionRun"(feedId);
CREATE INDEX IF NOT EXISTS idx_run_status ON "IngestionRun"(status);

CREATE TABLE IF NOT EXISTS "FeedError" (
  id           TEXT PRIMARY KEY,
  runId        TEXT NOT NULL REFERENCES "IngestionRun"(id) ON DELETE CASCADE,
  code         TEXT,
  message      TEXT NOT NULL,
  contextJson  JSONB,
  createdAt    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feederror_runId ON "FeedError"(runId);


