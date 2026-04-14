-- Migration 010 : Multi-tenancy
-- Ajoute accountId à FeedSource, Feed, Credential pour isoler les données par compte

-- 1. Table Account (un compte = une entreprise cliente)
CREATE TABLE IF NOT EXISTS "Account" (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'STARTER',
  email       TEXT,
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_plan ON "Account"(plan);

-- 2. Table User (un utilisateur appartient à un account)
CREATE TABLE IF NOT EXISTS "User" (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT, -- NULL si OAuth
  firstName   TEXT NOT NULL DEFAULT '',
  lastName    TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'OWNER',
  accountId   TEXT NOT NULL REFERENCES "Account"(id) ON DELETE CASCADE,
  provider    TEXT DEFAULT 'local', -- 'local', 'google'
  providerId  TEXT, -- Google sub ID
  createdAt   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedAt   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_accountid ON "User"(accountId);

-- 3. Ajouter accountid aux tables existantes
ALTER TABLE "FeedSource" ADD COLUMN IF NOT EXISTS accountid TEXT;
ALTER TABLE "Feed" ADD COLUMN IF NOT EXISTS accountid TEXT;
ALTER TABLE "Credential" ADD COLUMN IF NOT EXISTS accountid TEXT;

-- 4. Index sur accountid
CREATE INDEX IF NOT EXISTS idx_feedsource_accountid ON "FeedSource"(accountid);
CREATE INDEX IF NOT EXISTS idx_feed_accountid ON "Feed"(accountid);
CREATE INDEX IF NOT EXISTS idx_credential_accountid ON "Credential"(accountid);

-- 5. Créer un account par défaut pour les données existantes
INSERT INTO "Account" (id, name, plan, email)
VALUES ('default-account', 'FeedPlug Demo', 'STARTER', 'admin@feedplug.com')
ON CONFLICT (id) DO NOTHING;

-- 6. Assigner les données existantes au compte par défaut
UPDATE "FeedSource" SET accountid = 'default-account' WHERE accountid IS NULL;
UPDATE "Feed" SET accountid = 'default-account' WHERE accountid IS NULL;
UPDATE "Credential" SET accountid = 'default-account' WHERE accountid IS NULL;

-- 7. Créer un user admin par défaut
INSERT INTO "User" (id, email, password, firstName, lastName, role, accountId, provider)
VALUES (
  'admin-user',
  'admin@feedplug.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Admin',
  'FeedPlug',
  'OWNER',
  'default-account',
  'local'
)
ON CONFLICT (email) DO NOTHING;

-- 8. Rendre accountid NOT NULL après migration des données existantes
-- (commenté pour sécurité — décommenter après vérification)
-- ALTER TABLE "FeedSource" ALTER COLUMN accountid SET NOT NULL;
-- ALTER TABLE "Feed" ALTER COLUMN accountid SET NOT NULL;
-- ALTER TABLE "Credential" ALTER COLUMN accountid SET NOT NULL;
