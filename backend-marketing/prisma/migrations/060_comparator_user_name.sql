-- Profil CONSO du comparateur : prénom (capturé après la 1re vérif magic-link) + nom (optionnel).
-- Population SÉPARÉE du B2B. Colonnes minuscules, idempotent. NE touche PAS à l'onboarding/affinité.

ALTER TABLE "ComparatorUser" ADD COLUMN IF NOT EXISTS firstname text;
ALTER TABLE "ComparatorUser" ADD COLUMN IF NOT EXISTS lastname  text;
