-- A4 — Cache de génération d'images lifestyle.
-- Évite de régénérer (et donc de repayer Vertex/Imagen/Fal) une image déjà
-- produite pour la même combinaison source + scène + modèle + mannequin +
-- ratio. La clé est un sha256 déterministe ; la valeur est l'URL GCS de
-- l'image déjà générée. TTL long (90 j) géré applicativement via expiresat.
--
-- Table dédiée (et non "AICache") car AICache impose une FK providerId →
-- AIProvider et stocke du texte ; ici on n'a ni provider row ni texte, juste
-- une URL GCS. Idempotent (CREATE TABLE/INDEX IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS "ImageCache" (
  cachekey   TEXT PRIMARY KEY,            -- sha256(imageSourceHash + scene + model + mannequin + ratio)
  accountid  TEXT,                        -- compte propriétaire (best-effort, peut être NULL)
  url        TEXT NOT NULL,               -- URL GCS publique de l'image générée
  mimetype   TEXT,                        -- content-type de l'image
  expiresat  TIMESTAMPTZ NOT NULL,        -- TTL (création + 90 j)
  createdat  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imagecache_expires ON "ImageCache"(expiresat);
CREATE INDEX IF NOT EXISTS idx_imagecache_account ON "ImageCache"(accountid);
