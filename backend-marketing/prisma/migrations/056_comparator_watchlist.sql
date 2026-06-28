-- Watchlist CONSO du comparateur : produits suivis par un utilisateur, par pays.
-- Capture le prix au moment de l'ajout (priceatadd) pour mesurer la baisse depuis le suivi.
-- Tables PascalCase, colonnes minuscules. Idempotent.

CREATE TABLE IF NOT EXISTS "ComparatorWatchlist" (
  id          text PRIMARY KEY,
  userid      text NOT NULL,
  groupid     text NOT NULL,
  countrycode text NOT NULL DEFAULT 'FR',
  priceatadd  numeric,
  currency    text,
  createdat   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparatorwatchlist_user_group_country
  ON "ComparatorWatchlist" (userid, groupid, countrycode);
CREATE INDEX IF NOT EXISTS idx_comparatorwatchlist_userid ON "ComparatorWatchlist" (userid);
