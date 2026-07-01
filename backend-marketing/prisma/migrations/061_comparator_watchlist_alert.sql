-- Anti-spam des alertes baisse de prix : mémorise le dernier prix notifié par
-- produit suivi. On ne ré-alerte que sur une NOUVELLE baisse sous ce niveau
-- (référence = lastalertedprice si défini, sinon priceatadd). Idempotent.

ALTER TABLE "ComparatorWatchlist"
  ADD COLUMN IF NOT EXISTS lastalertedprice numeric,
  ADD COLUMN IF NOT EXISTS lastalertedat    timestamptz;
