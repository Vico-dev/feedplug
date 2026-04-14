-- Add-on Pack IA (génération titres + images) par compte
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS addonia BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN "Account".addonia IS 'Pack IA souscrit (+49 € HT/mois) : génération titres + images';
