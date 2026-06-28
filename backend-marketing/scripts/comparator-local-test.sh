#!/usr/bin/env bash
#
# Test LOCAL du backend comparateur CSS (matching multi-pays, prix par pays,
# historique de prix, gating d'approbation AWIN).
#
# ⚠️  Pointe sur une base Postgres JETABLE : le schéma y est (re)matérialisé et la
#     base est modifiée. NE PAS pointer sur la prod ni sur ta base de dev habituelle.
#
# Usage :
#   bash scripts/comparator-local-test.sh postgresql://user:pass@localhost:5432/feedplug_test
#   # ou : export COMPARATOR_TEST_DATABASE_URL=... ; bash scripts/comparator-local-test.sh
#
# Prérequis : un Postgres local accessible, psql et npx disponibles.
#
set -euo pipefail

DB_URL="${1:-${COMPARATOR_TEST_DATABASE_URL:-${DATABASE_URL:-}}}"
if [ -z "$DB_URL" ]; then
  echo "Usage: $0 postgresql://user:pass@localhost:5432/feedplug_test"
  echo "       (ou exporter COMPARATOR_TEST_DATABASE_URL / DATABASE_URL)"
  exit 1
fi

# Se placer dans backend-marketing/ (le dossier parent de scripts/).
cd "$(dirname "$0")/.."

echo "🔧 Base cible : ${DB_URL%%\?*}"
echo ""
echo "1/3 → Matérialisation du schéma complet (prisma db push) sur la base jetable…"
# db push crée toutes les tables/colonnes de schema.prisma, y compris les modèles
# comparateur (ProductGroup, ProductGroupCountryPrice, ProductGroupPriceHistory) et
# les ajouts (FeedSource.approvalStatus/countryCode, FeedItem.groupId, …).
DATABASE_URL="$DB_URL" npx prisma db push --skip-generate --accept-data-loss

echo ""
echo "2/3 → Extension pg_trgm + index trigrammes (requis par le matching fuzzy)…"
# Prisma ne modélise pas les extensions ni les index GIN trigramme : on les pose en SQL.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_feeditem_title_trgm ON "FeedItem" USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_productgroup_normtitle_trgm ON "ProductGroup" USING gin (normtitle gin_trgm_ops);
SQL

echo ""
echo "3/3 → Tests d'intégration du comparateur…"
COMPARATOR_TEST_DATABASE_URL="$DB_URL" node --test tests/comparator/matching.integration.test.js

echo ""
echo "✅ Terminé. Pour un test bout-en-bout manuel (ingestion AWIN réelle) :"
echo "   export COMPARATOR_ACCOUNT_ID=comparator COMPARATOR_INGEST_SECRET=<secret> DATABASE_URL=$DB_URL"
echo "   # appliquer aussi la migration 048 (compte comparator) puis :"
echo "   # POST /api/v1/comparator/internal/sources  (x-comparator-secret: <secret>)"
echo "   # POST /api/v1/comparator/internal/sources/:id/approval  {\"status\":\"approved\"}"
echo "   # POST /api/v1/comparator/internal/ingest  {\"feedId\":\"…\"}"
