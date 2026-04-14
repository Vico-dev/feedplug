#!/bin/bash
# Script tout-en-un : configure gcloud, lance le proxy, applique les migrations, arrête le proxy.
# À lancer UNE FOIS dans ton Terminal (avec tes identifiants Google).
#
# Usage :
#   cd /Users/victorsoldet/Desktop/Feedplug
#   export PGPASSWORD="<votre-mot-de-passe-depuis-secret-manager>"
#   chmod +x backend-marketing/scripts/run-migrations-one-shot.sh
#   ./backend-marketing/scripts/run-migrations-one-shot.sh

set -e

PROJECT="feedplug-prod"
REGION="europe-west1"
INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
PROXY_PORT="5433"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/backend-marketing/prisma/migrations"

echo "🔧 FeedPlug – Application des migrations (one-shot)"
echo ""

# 1) gcloud dans le PATH si besoin
if ! command -v gcloud &>/dev/null; then
  export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3
  export PATH="/opt/homebrew/share/google-cloud-sdk/bin:$PATH"
fi
if ! command -v gcloud &>/dev/null; then
  echo "❌ gcloud introuvable. Installe Google Cloud SDK puis relance ce script."
  exit 1
fi

# 2) Projet
gcloud config set project "$PROJECT" --quiet 2>/dev/null || true

# 3) Credentials pour le proxy (obligatoire)
echo "📌 Vérification des identifiants Google (pour Cloud SQL Proxy)..."
if ! gcloud auth application-default print-access-token &>/dev/null; then
  echo "   Ouverture du navigateur pour te connecter (une seule fois)..."
  gcloud auth application-default login
fi

# 4) Mot de passe Postgres (depuis Secret Manager si non défini)
if [ -z "$PGPASSWORD" ]; then
  echo "📌 Récupération du mot de passe depuis Secret Manager..."
  DB_URL=$(gcloud secrets versions access latest --secret=database-url-marketing --project="$PROJECT" 2>/dev/null || true)
  if [ -n "$DB_URL" ]; then
    PGPASSWORD=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p' | sed 's/%40/@/g; s/%2F/\//g')
  fi
fi
if [ -z "$PGPASSWORD" ]; then
  echo "❌ Définis le mot de passe : export PGPASSWORD=\"<depuis-secret-manager>\""
  echo "   Ou récupère-le : gcloud secrets versions access latest --secret=database-url-marketing --project=$PROJECT"
  exit 1
fi

# 5) psql
if ! command -v psql &>/dev/null; then
  echo "❌ psql introuvable. Installe PostgreSQL client (ex: brew install libpq)."
  exit 1
fi

# 6) Télécharger le proxy si besoin
cd "$REPO_ROOT"
if [ ! -x "./cloud-sql-proxy" ]; then
  echo "📥 Téléchargement de Cloud SQL Proxy..."
  curl -sL -o cloud-sql-proxy "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64"
  chmod +x cloud-sql-proxy
fi

# 7) Démarrer le proxy sur 5433 (pour éviter un conflit avec un Postgres local)
echo "🔌 Démarrage du proxy Cloud SQL sur le port $PROXY_PORT..."
./cloud-sql-proxy "$PROJECT:$REGION:$INSTANCE" --port="$PROXY_PORT" &
PROXY_PID=$!
trap "kill $PROXY_PID 2>/dev/null || true" EXIT
sleep 4

# 8) Appliquer les migrations
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
  "016_account_trial.sql"
  "017_billing_onboarding.sql"
  "018_ab_test.sql"
  "019_channel_scoring_config.sql"
  "020_user_status_lastloginat.sql"
  "021_product_score_history.sql"
  "028_marketing_nurture.sql"
  "029_marketing_click_tracking.sql"
  "030_oauth_ephemeral_state.sql"
  "031_shared_rate_limits.sql"
)

echo "📦 Application des migrations..."
for migration in "${MIGRATIONS[@]}"; do
  migration_path="$MIGRATIONS_DIR/$migration"
  if [ ! -f "$migration_path" ]; then
    echo "   ⚠️  Saut (fichier absent) : $migration"
    continue
  fi
  echo "   → $migration"
  PGPASSWORD="$PGPASSWORD" psql -h 127.0.0.1 -p "$PROXY_PORT" -U "$USER" -d "$DATABASE" -f "$migration_path"
  echo "      ✅ OK"
done

echo ""
echo "✅ Toutes les migrations ont été appliquées."
echo "   Tu peux configurer DATABASE_URL sur Cloud Run pour utiliser la base."
