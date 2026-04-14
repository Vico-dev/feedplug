#!/bin/bash
# Script "one shot" pour appliquer TOUTES les migrations SQL marketing
# Usage :
#   1) Démarrer Cloud SQL Proxy dans un autre terminal :
#      ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db
#   2) Dans ce terminal :
#      export PGPASSWORD="MOT_DE_PASSE_FEEDPLUG_USER"
#      ./backend-marketing/scripts/apply-all-migrations-direct.sh

set -e

INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
PROJECT="feedplug-prod"
REGION="europe-west1"

echo "🔧 Application de TOUTES les migrations SQL FeedPlug Marketing"
echo "   Instance : $INSTANCE"
echo "   Database : $DATABASE"
echo "   User     : $USER"
echo ""

# Vérifier PGPASSWORD
if [ -z "$PGPASSWORD" ]; then
  echo "❌ La variable d'environnement PGPASSWORD n'est pas définie."
  echo "📝 Avant de lancer ce script, exécute :"
  echo "    export PGPASSWORD=\"MOT_DE_PASSE_FEEDPLUG_USER\""
  exit 1
fi

# Vérifier que psql est disponible
if ! command -v psql &> /dev/null; then
  echo "❌ psql non trouvé"
  echo "📝 Installe le client PostgreSQL (psql), puis relance ce script."
  exit 1
fi

echo "⚠️  Assure-toi que Cloud SQL Proxy tourne dans un autre terminal avec :"
echo "    ./cloud-sql-proxy $PROJECT:$REGION:$INSTANCE"
echo ""

# Liste des migrations à appliquer dans l'ordre
MIGRATIONS=(
  "001_create_marketing_leads.sql"
  "002_ingestion_models.sql"
  "003_custom_columns.sql"
  "004_scoring_models.sql"
  "005_ai_management.sql"
  "008_enrichment_history.sql"
  "010_multi_tenancy.sql"
  "011_dashboard_score_evolution.sql"
  "012_feature_ideas.sql"
  "028_marketing_nurture.sql"
  "029_marketing_click_tracking.sql"
  "030_oauth_ephemeral_state.sql"
  "031_shared_rate_limits.sql"
)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../prisma/migrations"

echo "📦 Application des migrations depuis : $MIGRATIONS_DIR"
echo ""

for migration in "${MIGRATIONS[@]}"; do
  migration_path="$MIGRATIONS_DIR/$migration"

  if [ ! -f "$migration_path" ]; then
    echo "⚠️  Migration introuvable, saut : $migration_path"
    continue
  fi

  echo "   → Application de $migration ..."
  if ! PGPASSWORD="$PGPASSWORD" psql -h localhost -U "$USER" -d "$DATABASE" -f "$migration_path"; then
    echo ""
    echo "❌ Erreur lors de l'application de $migration"
    echo "💡 Vérifie que :"
    echo "   1. Cloud SQL Proxy tourne : ./cloud-sql-proxy $PROJECT:$REGION:$INSTANCE"
    echo "   2. PGPASSWORD contient bien le mot de passe de l'utilisateur $USER"
    echo "   3. La base $DATABASE existe sur l'instance $INSTANCE"
    exit 1
  fi

  echo "      ✅ OK"
  echo ""
done

echo "✅ Toutes les migrations disponibles ont été appliquées (ou sautées si absentes)."
echo ""
echo "🧪 Tu peux vérifier les tables avec :"
echo "    psql -h localhost -U $USER -d $DATABASE"
echo "  puis dans psql :"
echo "    \\dt"
echo "    SELECT * FROM \"AIProvider\" LIMIT 5;"
echo "    SELECT * FROM \"EnrichmentHistory\" LIMIT 5;"
echo ""
echo "🎉 Base marketing à jour, tu peux maintenant finaliser la config côté Cloud Run (DATABASE_URL)."
