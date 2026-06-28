-- Comparateur CSS — historique de prix par produit canonique (ProductGroup) / pays / jour.
--
-- Contexte : pour faire du comparateur un « vecteur de choix » (et non une simple
-- liste de prix), on suit le prix le plus bas de chaque produit dans le temps, par
-- pays (les devises diffèrent d'un pays à l'autre, on ne mélange pas EUR et GBP).
-- Permet les signaux « au plus bas depuis 90 j », « -15 % vs le mois dernier »,
-- la sparkline et le badge « bon plan ».
--
-- Granularité : une ligne par (produit, pays, jour). Les groupes sont bien moins
-- nombreux que les offres -> table compacte. La capture par offre existe déjà via
-- FeedItemRevision (snapshotjson.price) ; ici on dénormalise le MIN par produit/pays.
--
-- PK composite (pas de surrogate id) ; UPSERT idempotent sur (groupid, countrycode,
-- capturedon). Idempotent (IF NOT EXISTS + garde DO pour la FK).

CREATE TABLE IF NOT EXISTS "ProductGroupPriceHistory" (
  groupid      TEXT NOT NULL,
  countrycode  TEXT NOT NULL DEFAULT '',          -- '' = pays non spécifié (mono-pays initial)
  capturedon   DATE NOT NULL,
  lowestprice  DOUBLE PRECISION NOT NULL,         -- prix le plus bas du produit ce jour-là, dans ce pays
  currency     TEXT,
  PRIMARY KEY (groupid, countrycode, capturedon)
);

CREATE INDEX IF NOT EXISTS idx_pgph_group_date ON "ProductGroupPriceHistory"(groupid, capturedon);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pgph_group_fkey'
  ) THEN
    ALTER TABLE "ProductGroupPriceHistory"
      ADD CONSTRAINT pgph_group_fkey
      FOREIGN KEY (groupid) REFERENCES "ProductGroup"(id) ON DELETE CASCADE;
  END IF;
END $$;
