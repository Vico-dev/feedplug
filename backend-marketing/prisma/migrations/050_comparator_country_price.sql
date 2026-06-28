-- Comparateur CSS — refonte du prix par PAYS + matching fuzzy fiabilisé.
--
-- Bug bloquant corrigé : ProductGroup.lowestprice/currency étaient des scalaires
-- GLOBAUX. Le matching GTIN fusionne (à juste titre) un même produit vendu dans
-- plusieurs pays dans un seul groupe → min(price) mélangeait les devises (EUR vs
-- GBP) et pouvait afficher un prix dans la mauvaise devise. Pour un CSS Google,
-- afficher un prix faux = risque de suspension. On sort donc le prix dans une
-- table par (produit, pays), pendant « live » de ProductGroupPriceHistory.
--
-- Fiabilisation du matching fuzzy : colonne normtitle (titre normalisé identique
-- des deux côtés de la comparaison) + index trigramme réellement utilisable via
-- l'opérateur %.
--
-- Idempotent (IF NOT EXISTS / IF EXISTS + garde DO sur la FK).

-- 1) Prix le plus bas « live » par produit canonique et par pays.
CREATE TABLE IF NOT EXISTS "ProductGroupCountryPrice" (
  groupid      TEXT NOT NULL,
  countrycode  TEXT NOT NULL DEFAULT '',
  lowestprice  DOUBLE PRECISION NOT NULL,
  currency     TEXT,
  offercount   INTEGER NOT NULL DEFAULT 0,
  updatedat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (groupid, countrycode)
);
CREATE INDEX IF NOT EXISTS idx_pgcp_group ON "ProductGroupCountryPrice"(groupid);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pgcp_group_fkey') THEN
    ALTER TABLE "ProductGroupCountryPrice"
      ADD CONSTRAINT pgcp_group_fkey
      FOREIGN KEY (groupid) REFERENCES "ProductGroup"(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Titre normalisé pour le matching fuzzy symétrique (les deux côtés normalisés).
ALTER TABLE "ProductGroup" ADD COLUMN IF NOT EXISTS normtitle TEXT;
CREATE INDEX IF NOT EXISTS idx_productgroup_normtitle_trgm
  ON "ProductGroup" USING gin (normtitle gin_trgm_ops);

-- 3) Retrait des scalaires de prix globaux (remplacés par ProductGroupCountryPrice).
--    Aucune route ne les lit encore ; refreshGroupAggregates est mis à jour en même temps.
ALTER TABLE "ProductGroup" DROP COLUMN IF EXISTS lowestprice;
ALTER TABLE "ProductGroup" DROP COLUMN IF EXISTS currency;
