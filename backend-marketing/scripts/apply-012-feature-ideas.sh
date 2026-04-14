#!/bin/bash
# Applique uniquement la migration 012 (table feature_ideas) en prod.
#
# Prérequis :
#   1. Cloud SQL Proxy doit tourner (dans un autre terminal) :
#      ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db
#   2. Variable d'environnement : export PGPASSWORD="MOT_DE_PASSE_FEEDPLUG_USER"
#
# Usage :
#   export PGPASSWORD="ton_mot_de_passe"
#   ./backend-marketing/scripts/apply-012-feature-ideas.sh

set -e

INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATION="$SCRIPT_DIR/../prisma/migrations/012_feature_ideas.sql"

echo "🔧 Application de la migration 012 (feature_ideas)..."
echo "   Base : $DATABASE @ localhost (Cloud SQL Proxy)"
echo ""

if [ -z "$PGPASSWORD" ]; then
  echo "❌ Définis PGPASSWORD avant de lancer le script :"
  echo "   export PGPASSWORD=\"ton_mot_de_passe\""
  exit 1
fi

if [ ! -f "$MIGRATION" ]; then
  echo "❌ Fichier introuvable : $MIGRATION"
  exit 1
fi

echo "⚠️  Assure-toi que Cloud SQL Proxy tourne dans un autre terminal :"
echo "   ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db"
echo ""
read -p "Appuyer sur Entrée pour continuer (ou Ctrl+C pour annuler)..."

psql -h localhost -U "$USER" -d "$DATABASE" -f "$MIGRATION"

echo ""
echo "✅ Migration 012 appliquée. La table feature_ideas est créée."
