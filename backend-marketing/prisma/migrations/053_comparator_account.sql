-- Comptes CONSOMMATEURS du comparateur (population SÉPARÉE des comptes B2B "Account"/"User").
-- Auth magic-link sans mot de passe. Tables PascalCase, colonnes minuscules. Idempotent.

-- Identité conso
CREATE TABLE IF NOT EXISTS "ComparatorUser" (
  id             text PRIMARY KEY,
  email          text NOT NULL,
  emailverified  boolean NOT NULL DEFAULT false,
  countrycode    text NOT NULL DEFAULT 'FR',
  locale         text NOT NULL DEFAULT 'fr',
  status         text NOT NULL DEFAULT 'active',          -- active|suspended|deleted (RGPD)
  marketingoptin boolean NOT NULL DEFAULT false,
  consentat      timestamptz,
  lastloginat    timestamptz,
  createdat      timestamptz NOT NULL DEFAULT now(),
  updatedat      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparatoruser_email ON "ComparatorUser" (lower(email));

-- Jetons magic-link (jamais le token en clair : seul son sha256). Single-use + expiration.
CREATE TABLE IF NOT EXISTS "ComparatorMagicLink" (
  id         text PRIMARY KEY,
  userid     text,
  email      text NOT NULL,
  tokenhash  text NOT NULL,
  purpose    text NOT NULL DEFAULT 'login',               -- login|signup
  expiresat  timestamptz NOT NULL,
  consumedat timestamptz,                                  -- non-null = déjà utilisé
  iphash     text,
  createdat  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comparatormagiclink_tokenhash ON "ComparatorMagicLink" (tokenhash);
CREATE INDEX IF NOT EXISTS idx_comparatormagiclink_email_created ON "ComparatorMagicLink" (lower(email), createdat);

-- Sessions conso (cookie opaque, hash en base, révocables côté serveur).
CREATE TABLE IF NOT EXISTS "ComparatorSession" (
  id         text PRIMARY KEY,
  userid     text NOT NULL,
  tokenhash  text NOT NULL,
  expiresat  timestamptz NOT NULL,
  revokedat  timestamptz,
  useragent  text,
  iphash     text,
  createdat  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comparatorsession_tokenhash ON "ComparatorSession" (tokenhash);
CREATE INDEX IF NOT EXISTS idx_comparatorsession_userid ON "ComparatorSession" (userid);
