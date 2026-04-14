-- Migration pour ajouter le support des colonnes personnalisées

-- Ajouter customFields à FeedItem
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS "customfields" JSONB;

-- Créer la table CustomColumn
CREATE TABLE IF NOT EXISTS "CustomColumn" (
  id              TEXT PRIMARY KEY,
  sourceId        TEXT NOT NULL REFERENCES "FeedSource"(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  label           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('text', 'number', 'float', 'boolean', 'date')),
  isPredefined    BOOLEAN NOT NULL DEFAULT false,
  isRequired      BOOLEAN NOT NULL DEFAULT false,
  defaultValue    TEXT,
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customcolumn_source_key ON "CustomColumn"(sourceId, key);
CREATE INDEX IF NOT EXISTS idx_customcolumn_sourceId ON "CustomColumn"(sourceId);






