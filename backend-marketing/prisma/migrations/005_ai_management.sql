-- Migration pour la gestion des clés API IA et des coûts

-- Table pour stocker les clés API IA (Gemini, OpenAI, etc.)
CREATE TABLE IF NOT EXISTS "AIProvider" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE, -- 'GEMINI', 'OPENAI', 'MISTRAL', etc.
  displayName     TEXT NOT NULL, -- 'Google Gemini', 'OpenAI GPT', etc.
  apiUrl          TEXT NOT NULL,
  defaultModel    TEXT NOT NULL, -- 'gemini-pro', 'gpt-4o-mini', etc.
  costPerToken    DECIMAL(10, 8) NOT NULL DEFAULT 0.0001, -- Coût par token (input)
  costPerOutputToken DECIMAL(10, 8) NOT NULL DEFAULT 0.0001, -- Coût par token (output)
  isActive        BOOLEAN NOT NULL DEFAULT true,
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour stocker les clés API configurées
CREATE TABLE IF NOT EXISTS "AIProviderKey" (
  id              TEXT PRIMARY KEY,
  providerId      TEXT NOT NULL REFERENCES "AIProvider"(id) ON DELETE CASCADE,
  name            TEXT NOT NULL, -- Nom de la clé (ex: "Clé principale", "Clé backup")
  apiKey          TEXT NOT NULL, -- Clé API chiffrée
  isDefault       BOOLEAN NOT NULL DEFAULT false,
  isActive        BOOLEAN NOT NULL DEFAULT true,
  monthlyLimit    INTEGER, -- Limite mensuelle en requêtes (null = illimité)
  dailyLimit      INTEGER, -- Limite quotidienne en requêtes (null = illimité)
  monthlyUsage    INTEGER NOT NULL DEFAULT 0,
  dailyUsage      INTEGER NOT NULL DEFAULT 0,
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour tracker l'utilisation et les coûts
CREATE TABLE IF NOT EXISTS "AIUsage" (
  id              TEXT PRIMARY KEY,
  providerKeyId   TEXT REFERENCES "AIProviderKey"(id) ON DELETE CASCADE,
  operation       TEXT NOT NULL,
  itemId          TEXT,
  provider        TEXT, -- 'gemini' etc. (utilisé quand pas de clé DB)
  "tokensUsed"    INTEGER NOT NULL DEFAULT 0,
  inputTokens     INTEGER NOT NULL DEFAULT 0,
  outputTokens    INTEGER NOT NULL DEFAULT 0,
  cost            DECIMAL(10, 6) NOT NULL DEFAULT 0,
  success         BOOLEAN NOT NULL DEFAULT true,
  errorMessage    TEXT,
  cached          BOOLEAN NOT NULL DEFAULT false,
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour le cache des résultats IA
CREATE TABLE IF NOT EXISTS "AICache" (
  id              TEXT PRIMARY KEY,
  providerId      TEXT NOT NULL REFERENCES "AIProvider"(id) ON DELETE CASCADE,
  operation       TEXT NOT NULL,
  inputHash       TEXT NOT NULL UNIQUE,
  result          TEXT NOT NULL, -- Texte brut (titre/description généré)
  provider        TEXT NOT NULL DEFAULT 'gemini',
  expiresAt       TIMESTAMPTZ NOT NULL,
  createdAt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_aiusage_providerkey ON "AIUsage"(providerKeyId);
CREATE INDEX IF NOT EXISTS idx_aiusage_createdat ON "AIUsage"(createdAt);
CREATE INDEX IF NOT EXISTS idx_aiusage_operation ON "AIUsage"(operation);
CREATE INDEX IF NOT EXISTS idx_aicache_hash ON "AICache"(inputHash);
CREATE INDEX IF NOT EXISTS idx_aicache_expires ON "AICache"(expiresAt);
CREATE INDEX IF NOT EXISTS idx_aiproviderkey_provider ON "AIProviderKey"(providerId);
CREATE INDEX IF NOT EXISTS idx_aiproviderkey_active ON "AIProviderKey"(isActive);

-- Insérer les providers par défaut
INSERT INTO "AIProvider" (id, name, displayName, apiUrl, defaultModel, costPerToken, costPerOutputToken, isActive) VALUES
  ('gemini', 'GEMINI', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/models', 'gemini-pro', 0.00000025, 0.0000005, true),
  ('openai', 'OPENAI', 'OpenAI GPT', 'https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', 0.00000015, 0.0000006, true),
  ('mistral', 'MISTRAL', 'Mistral AI', 'https://api.mistral.ai/v1/chat/completions', 'mistral-small', 0.0000002, 0.0000006, true)
ON CONFLICT (name) DO NOTHING;

-- Colonnes usage (au cas où la table existait déjà sans elles)
ALTER TABLE "AIProviderKey" ADD COLUMN IF NOT EXISTS "monthlyUsage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AIProviderKey" ADD COLUMN IF NOT EXISTS "dailyUsage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AIUsage" ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE "AIUsage" ADD COLUMN IF NOT EXISTS "tokensUsed" INTEGER NOT NULL DEFAULT 0;


