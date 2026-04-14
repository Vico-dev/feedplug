-- Infos entreprise et facturation pour prospection (tous les clients, inscription ou Google)
ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS companyname TEXT,
  ADD COLUMN IF NOT EXISTS phonee164 TEXT,
  ADD COLUMN IF NOT EXISTS billingemail TEXT;

COMMENT ON COLUMN "Account".companyname IS 'Nom de l''entreprise (raison sociale)';
COMMENT ON COLUMN "Account".phonee164 IS 'Téléphone au format E.164 (ex. +33612345678)';
COMMENT ON COLUMN "Account".billingemail IS 'Email de facturation pour prospection';
