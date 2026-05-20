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

# Liste des migrations à appliquer dans l'ordre.
# Chaque fichier est idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
# EXISTS, etc.) donc rejouer une migration déjà appliquée est sans effet.
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
  "013_export_channel.sql"
  "014_rules_revisions_bulk_edit.sql"
  "015_enrichment_source.sql"
  "016_account_trial.sql"
  "017_billing_onboarding.sql"
  "018_ab_test.sql"
  "019_channel_scoring_config.sql"
  "020_user_status_lastloginat.sql"
  "021_product_score_history.sql"
  "022_ab_test_rule_id.sql"
  "023_platform_connection_unique.sql"
  "024_account_addon_ia.sql"
  "025_account_company_phone_billing.sql"
  "026_account_max_channels.sql"
  "027_account_billing_status.sql"
  "027_performance_channel_history.sql"
  "028_marketing_nurture.sql"
  "029_marketing_click_tracking.sql"
  "030_oauth_ephemeral_state.sql"
  "031_shared_rate_limits.sql"
  "032_markets_market_runtime.sql"
  "033_stripe_webhook_events.sql"
  "034_feed_autopush.sql"
  "035_ai_usage.sql"
  "036_notifications.sql"
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

  # Migrations qui ne sont PAS idempotentes (ALTER sans IF NOT EXISTS, etc.) :
  # on les laisse échouer silencieusement si déjà jouées, sinon on plante tout
  # le script à chaque relance dès que la prod aurait avancé.
  # Toutes les migrations sont désormais idempotentes (CREATE … IF NOT EXISTS,
  # DO $$ … EXCEPTION WHEN duplicate_object … pour les TYPES/contraintes).
  NON_IDEMPOTENT=()
  is_non_idempotent=false
  for ni in "${NON_IDEMPOTENT[@]}"; do
    if [ "$migration" = "$ni" ]; then is_non_idempotent=true; fi
  done

  echo "   → Application de $migration ..."
  if PGPASSWORD="$PGPASSWORD" psql -h localhost -U "$USER" -d "$DATABASE" -v ON_ERROR_STOP=1 -f "$migration_path"; then
    echo "      ✅ OK"
  elif [ "$is_non_idempotent" = true ]; then
    echo "      ⚠️  Échec ignoré (migration $migration non idempotente, probablement déjà appliquée)."
  else
    echo ""
    echo "❌ Erreur lors de l'application de $migration"
    echo "💡 Vérifie que :"
    echo "   1. Cloud SQL Proxy tourne : ./cloud-sql-proxy $PROJECT:$REGION:$INSTANCE"
    echo "   2. PGPASSWORD contient bien le mot de passe de l'utilisateur $USER"
    echo "   3. La base $DATABASE existe sur l'instance $INSTANCE"
    exit 1
  fi
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
