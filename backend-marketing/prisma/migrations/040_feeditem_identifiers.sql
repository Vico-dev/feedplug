-- Identifiants produit GMC sur FeedItem : gtin, mpn, condition.
-- Ces colonnes sont requises par l'export multi-canal (server-minimal.js) et
-- l'ingestion CSV/PrestaShop, mais n'étaient créées par aucune migration —
-- elles n'existaient qu'ajoutées manuellement en production. Idempotent :
-- no-op si les colonnes existent déjà.
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS gtin TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS mpn TEXT;
ALTER TABLE "FeedItem" ADD COLUMN IF NOT EXISTS condition TEXT;
