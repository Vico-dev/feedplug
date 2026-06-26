-- Révocation JWT :
--  * User.passwordchangedat : tout token signé avant cette date est rejeté
--    (couvre password change / reset / accept-invitation : déconnecte les
--     autres devices après changement de mot de passe).
--  * RevokedJti : révocation explicite d'un token précis sur logout, sans
--    déconnecter les autres sessions du même utilisateur.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS passwordchangedat TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "User"
  SET passwordchangedat = COALESCE(createdat, NOW())
  WHERE passwordchangedat IS NULL;

CREATE TABLE IF NOT EXISTS "RevokedJti" (
  jti        TEXT PRIMARY KEY,
  userid     TEXT,
  expiresat  TIMESTAMPTZ NOT NULL,
  createdat  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permet le purge périodique des entrées expirées sans full scan.
CREATE INDEX IF NOT EXISTS revokedjti_expiresat_idx ON "RevokedJti"(expiresat);
