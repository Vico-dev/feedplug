-- A2 — Séparer compteurs texte / images dans ai_usage.
-- On ajoute une colonne `kind` ('text' | 'image') et on fait passer la clé
-- primaire de (accountid, period) à (accountid, period, kind) pour que chaque
-- type de consommation IA ait son propre compteur (et ses propres seuils
-- d'alerte 80 % / 100 %).
--
-- Idempotent :
--   - ADD COLUMN IF NOT EXISTS pour `kind`.
--   - DROP de la PK existante quel que soit son nom (via pg_constraint), puis
--     recréation sur (accountid, period, kind) seulement si elle n'existe pas
--     déjà. Une 2e exécution est donc un no-op.

-- 1) Colonne kind (défaut 'text' : tout l'historique compte comme du texte).
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text';

-- 2) Drop de l'ancienne PK (nom variable selon l'historique : ai_usage_pkey
--    par défaut, mais on retrouve le vrai nom via le catalogue) si elle ne
--    porte pas déjà sur kind.
DO $$
DECLARE
  pk_name TEXT;
  pk_has_kind BOOLEAN;
BEGIN
  SELECT con.conname,
         EXISTS (
           SELECT 1
           FROM unnest(con.conkey) AS colnum
           JOIN pg_attribute att
             ON att.attrelid = con.conrelid AND att.attnum = colnum
           WHERE att.attname = 'kind'
         )
    INTO pk_name, pk_has_kind
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  WHERE cls.relname = 'ai_usage'
    AND con.contype = 'p'
  LIMIT 1;

  IF pk_name IS NOT NULL AND pk_has_kind IS NOT TRUE THEN
    EXECUTE format('ALTER TABLE ai_usage DROP CONSTRAINT %I', pk_name);
  END IF;
END
$$;

-- 3) Recréation de la PK sur (accountid, period, kind) si absente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    WHERE cls.relname = 'ai_usage'
      AND con.contype = 'p'
  ) THEN
    ALTER TABLE ai_usage ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (accountid, period, kind);
  END IF;
END
$$;
