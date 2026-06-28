-- Comparateur CSS — produit canonique (ProductGroup) regroupant les offres d'un
-- même produit chez plusieurs marchands, dimension pays sur les sources, et index
-- de matching/recherche sur FeedItem.
--
-- Contexte : pour devenir CSS Google, Feedplug opère un comparateur de prix public
-- alimenté par des flux marchands (AWIN). Un ProductGroup = un produit canonique ;
-- chaque FeedItem rattaché = une offre marchand. Le matching se fait en cascade
-- (GTIN exact -> MPN+marque -> titre fuzzy via pg_trgm).
--
-- FK relâchée sur accountid (cohérent avec ImageCache) ; FK groupid -> ProductGroup
-- avec ON DELETE SET NULL pour ne pas perdre les offres si un groupe est supprimé.
-- Idempotent (IF NOT EXISTS + gardes DO pour les contraintes).

-- 1) Dimension pays sur les sources (un flux AWIN couvre un pays de livraison).
ALTER TABLE "FeedSource" ADD COLUMN IF NOT EXISTS countrycode TEXT;

-- 2) Produit canonique du comparateur.
CREATE TABLE IF NOT EXISTS "ProductGroup" (
  id              TEXT PRIMARY KEY,
  accountid       TEXT NOT NULL,            -- compte interne "comparator" (isolation multi-tenant)
  gtin            TEXT,                     -- clé de matching la plus forte (NULL si fuzzy)
  canonicaltitle  TEXT NOT NULL,            -- titre représentatif du groupe
  brand           TEXT,
  imageurl        TEXT,
  category        TEXT,
  offercount      INTEGER NOT NULL DEFAULT 0,  -- nb d'offres rattachées (dénormalisé)
  lowestprice     DOUBLE PRECISION,         -- prix le plus bas parmi les offres (dénormalisé)
  currency        TEXT,
  createdat       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul groupe par (compte, gtin) quand le gtin est présent. Les groupes sans gtin
-- (matching fuzzy) coexistent : Postgres considère les NULL comme distincts.
CREATE UNIQUE INDEX IF NOT EXISTS productgroup_account_gtin_key ON "ProductGroup"(accountid, gtin);
CREATE INDEX IF NOT EXISTS idx_productgroup_account ON "ProductGroup"(accountid);

-- 3) Rattachement des offres (FeedItem) à un groupe + métadonnées de matching.
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS groupid TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS matchstrategy TEXT;     -- 'gtin' | 'mpn_brand' | 'fuzzy_title'
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS matchconfidence INTEGER; -- 0..100

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feeditem_groupid_fkey'
  ) THEN
    ALTER TABLE "FeedItem"
      ADD CONSTRAINT feeditem_groupid_fkey
      FOREIGN KEY (groupid) REFERENCES "ProductGroup"(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feeditem_groupid ON "FeedItem"(groupid);
CREATE INDEX IF NOT EXISTS idx_feeditem_gtin ON "FeedItem"(gtin);

-- 4) Recherche/matching fuzzy par titre (trigrammes) — sert le matcher niveau 3
--    et la recherche full-text du comparateur public.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_feeditem_title_trgm ON "FeedItem" USING gin (title gin_trgm_ops);
