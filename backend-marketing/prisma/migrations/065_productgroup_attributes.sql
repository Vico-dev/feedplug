-- 065_productgroup_attributes.sql — Attributs produit enrichis (IA) sur le comparateur.
-- `attributes` (jsonb) porte les champs déduits quand le flux ne les fournit pas :
-- couleur aujourd'hui ({"color": "noir"}), matière/genre/… demain. Rempli par
-- domains/comparator/ai-categorization.js (merge non destructif, la donnée flux
-- reste prioritaire). Idempotent.

ALTER TABLE "ProductGroup" ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;
