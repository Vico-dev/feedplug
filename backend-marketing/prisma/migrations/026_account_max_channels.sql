-- Limite de canaux d'export par compte (configurateur 1-5, ou sur devis = NULL = illimité)
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS max_channels SMALLINT DEFAULT 5;
COMMENT ON COLUMN "Account".max_channels IS 'Nombre max de canaux d''export (1-5 depuis configurateur). NULL = illimité (sur devis).';
