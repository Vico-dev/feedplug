#!/usr/bin/env bash
# Applique uniquement la migration 032 (socle Markets market-first).
# Idempotente : la migration utilise CREATE TABLE IF NOT EXISTS / ADD COLUMN
# IF NOT EXISTS partout, donc rejouer ce script ne casse rien.
#
# Usage :
#   1) Dans un terminal séparé, démarre Cloud SQL Proxy :
#        ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db
#   2) Dans ce terminal :
#        export PGPASSWORD="MOT_DE_PASSE_FEEDPLUG_USER"
#        ./backend-marketing/scripts/apply-markets-migration.sh

set -e

INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
# Le proxy Cloud SQL peut tourner sur 5432 (par défaut) ou un autre port si
# Postgres tourne déjà localement. Override avec PGHOST / PGPORT.
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

echo "🌍 Application de la migration Markets (032)"
echo "   Instance : $INSTANCE"
echo "   Database : $DATABASE"
echo "   User     : $USER"
echo "   Endpoint : $PGHOST:$PGPORT"
echo ""

if [ -z "$PGPASSWORD" ]; then
  echo "❌ La variable d'environnement PGPASSWORD n'est pas définie."
  echo "📝 Avant de lancer ce script, exécute :"
  echo "    export PGPASSWORD=\"MOT_DE_PASSE_FEEDPLUG_USER\""
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql introuvable dans le PATH."
  echo "📝 Installe-le via : brew install libpq && brew link --force libpq"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATION_PATH="$SCRIPT_DIR/../prisma/migrations/032_markets_market_runtime.sql"

if [ ! -f "$MIGRATION_PATH" ]; then
  echo "❌ Migration introuvable : $MIGRATION_PATH"
  exit 1
fi

echo "📦 Application de 032_markets_market_runtime.sql ..."
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$USER" -d "$DATABASE" -v ON_ERROR_STOP=1 -f "$MIGRATION_PATH"

echo ""
echo "✅ Migration Markets appliquée."
echo ""
echo "🧪 Vérifie les tables avec :"
echo "    psql -h $PGHOST -p $PGPORT -U $USER -d $DATABASE -c \"SELECT tablename FROM pg_tables WHERE tablename LIKE 'Market%' OR tablename IN ('PlatformAccount','Destination','ProductActivation') ORDER BY tablename;\""
echo "    psql -h $PGHOST -p $PGPORT -U $USER -d $DATABASE -c 'SELECT count(*) FROM \"Market\";'"
echo ""
echo "🚀 L'API /api/v1/markets devrait maintenant répondre 200 (avec un tableau vide)"
echo "   pour les comptes sans marché. Le bouton « Créer un marché » devient utilisable."
