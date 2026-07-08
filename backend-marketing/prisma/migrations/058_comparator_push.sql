-- Abonnements push du comparateur (Web Push ; étendu au natif par 062).
-- Recrée la migration de base perdue — la table existe déjà en prod, tout est
-- IF NOT EXISTS pour rester idempotent. Miroir exact du schéma prod.

CREATE TABLE IF NOT EXISTS "ComparatorPushSubscription" (
  id             text PRIMARY KEY,
  userid         text NOT NULL,
  endpoint       text,
  p256dh         text,
  auth           text,
  platform       text NOT NULL DEFAULT 'web',
  useragent      text,
  failurecount   integer NOT NULL DEFAULT 0,
  lastnotifiedat timestamptz,
  createdat      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comparatorpush_endpoint
  ON "ComparatorPushSubscription" (endpoint);
CREATE INDEX IF NOT EXISTS idx_comparatorpush_userid
  ON "ComparatorPushSubscription" (userid);
