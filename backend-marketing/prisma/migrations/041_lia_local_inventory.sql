-- Google Local Inventory Ads (LIA) : magasins physiques du compte et
-- inventaire par magasin × offre, utilisés pour générer le flux
-- d'inventaire local (store_code, id, quantity, availability, ...).

CREATE TABLE IF NOT EXISTS "StoreLocation" (
  id        TEXT PRIMARY KEY,
  accountid TEXT NOT NULL,
  storecode TEXT NOT NULL,           -- code magasin Google Business Profile
  name      TEXT,
  address   TEXT,
  isactive  BOOLEAN NOT NULL DEFAULT true,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (accountid, storecode)
);

CREATE INDEX IF NOT EXISTS storelocation_account_idx ON "StoreLocation"(accountid);

CREATE TABLE IF NOT EXISTS "LocalInventory" (
  id           TEXT PRIMARY KEY,
  accountid    TEXT NOT NULL,
  storecode    TEXT NOT NULL,
  offerid      TEXT NOT NULL,        -- correspond à FeedItem.originid (id produit du flux)
  quantity     INTEGER NOT NULL DEFAULT 0,
  availability TEXT,                 -- in stock | out of stock | limited availability | on display to order
  price        NUMERIC(12,2),        -- prix magasin optionnel (sinon hérite du flux produit)
  saleprice    NUMERIC(12,2),
  pickupmethod TEXT,                 -- buy | reserve | ship to store | not supported
  pickupsla    TEXT,                 -- same day | next day | 2-day ... | multi-week
  createdat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (accountid, storecode, offerid)
);

CREATE INDEX IF NOT EXISTS localinventory_account_offer_idx ON "LocalInventory"(accountid, offerid);
CREATE INDEX IF NOT EXISTS localinventory_account_store_idx ON "LocalInventory"(accountid, storecode);
