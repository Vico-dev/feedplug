-- LIA × Shopify POS : lien entre un magasin LIA (StoreLocation) et un
-- emplacement Shopify (Location GID), pour synchroniser automatiquement le
-- stock par magasin depuis les inventoryLevels Shopify au lieu d'un import
-- CSV manuel. shopifylocationid = "gid://shopify/Location/123".

ALTER TABLE "StoreLocation" ADD COLUMN IF NOT EXISTS shopifylocationid TEXT;

CREATE INDEX IF NOT EXISTS storelocation_shopify_location_idx
  ON "StoreLocation"(accountid, shopifylocationid);
