-- Comparateur CSS — journal des clics sortants (liens marchands trackés).
--
-- L'endpoint public /api/v1/comparator/visit/:offerId loggue le clic puis redirige
-- vers le deep link marchand (AWIN aw_deep_link, déjà tracké pour la rému CPA).
-- iphash = sha256(ip + sel) : on ne stocke PAS l'IP en clair (RGPD).
-- FK relâchée sur offerid (cohérent avec le style du repo). Idempotent.

CREATE TABLE IF NOT EXISTS "ClickEvent" (
  id           TEXT PRIMARY KEY,
  offerid      TEXT NOT NULL,            -- FeedItem.id de l'offre cliquée
  groupid      TEXT,                     -- produit canonique (analytics)
  countrycode  TEXT,
  iphash       TEXT,                     -- sha256(ip + COMPARATOR_CLICK_SALT)
  useragent    TEXT,
  referer      TEXT,
  targeturl    TEXT NOT NULL,            -- deep link marchand résolu (audit)
  createdat    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clickevent_offer   ON "ClickEvent"(offerid);
CREATE INDEX IF NOT EXISTS idx_clickevent_group   ON "ClickEvent"(groupid);
CREATE INDEX IF NOT EXISTS idx_clickevent_created ON "ClickEvent"(createdat);
