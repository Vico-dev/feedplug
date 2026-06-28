-- Consentement comparateur : un client B2B peut choisir d'apparaître (ou non) dans le
-- comparateur public CSS. Opt-IN strict (défaut false) : un client n'est diffusé que
-- s'il a explicitement accepté. Le matching et l'API n'incluent ses produits que si true.
-- Idempotent.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS comparatoroptin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_account_comparatoroptin ON "Account"(comparatoroptin) WHERE comparatoroptin = true;
