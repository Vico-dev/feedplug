-- Tracking par utilisateur pour le cashback : relier un clic (clickref) à un user connu,
-- afin de rapprocher ensuite de la conversion AWIN (Transactions API / webhook).
-- Le clic anonyme reste tracké (userid NULL) mais ne donnera pas de cashback. Idempotent.
ALTER TABLE "ClickEvent" ADD COLUMN IF NOT EXISTS userid       text;
ALTER TABLE "ClickEvent" ADD COLUMN IF NOT EXISTS clickref     text;
ALTER TABLE "ClickEvent" ADD COLUMN IF NOT EXISTS merchantname text;

-- Lookup du poll/webhook AWIN : transaction.clickRef → ClickEvent.clickref → userid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clickevent_clickref ON "ClickEvent" (clickref) WHERE clickref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clickevent_userid ON "ClickEvent" (userid) WHERE userid IS NOT NULL;
