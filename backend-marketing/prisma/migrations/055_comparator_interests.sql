-- Intérêts CONSO du comparateur : catégories suivies par un utilisateur (population séparée du B2B).
-- Set complet remplaçable côté API. Tables PascalCase, colonnes minuscules. Idempotent.

CREATE TABLE IF NOT EXISTS "ComparatorInterest" (
  userid     text NOT NULL,
  categoryid text NOT NULL,
  createdat  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (userid, categoryid)
);
CREATE INDEX IF NOT EXISTS idx_comparatorinterest_userid ON "ComparatorInterest" (userid);
CREATE INDEX IF NOT EXISTS idx_comparatorinterest_categoryid ON "ComparatorInterest" (categoryid);
