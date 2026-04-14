-- Colonne optionnelle pour l'évolution du score moyen (remplie après chaque run réussi)
ALTER TABLE "IngestionRun" ADD COLUMN IF NOT EXISTS avg_score_after INT;
