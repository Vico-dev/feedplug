#!/bin/bash
# Script pour appliquer toutes les migrations SQL à la base de données

set -e

PROJECT_ID="feedplug-prod"
INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
REGION="europe-west1"

echo "🔧 Application des migrations SQL pour FeedPlug Marketing"
echo "   Instance: $INSTANCE"
echo "   Database: $DATABASE"
echo "   User: $USER"
echo ""

# Vérifier si gcloud est disponible
GCLOUD_CMD=""
if command -v gcloud &> /dev/null; then
    GCLOUD_CMD="gcloud"
elif [ -f "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD_CMD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
fi

if [ -z "$GCLOUD_CMD" ]; then
    echo "❌ gcloud n'est pas disponible"
    echo "📝 Veuillez installer gcloud ou utiliser Cloud SQL Proxy"
    exit 1
fi

# Obtenir le mot de passe (demander à l'utilisateur)
echo "⚠️  Vous allez être invité à entrer le mot de passe de l'utilisateur $USER"
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
    "013_export_channel.sql"
    "028_marketing_nurture.sql"
    "029_marketing_click_tracking.sql"
    "030_oauth_ephemeral_state.sql"
    "031_shared_rate_limits.sql"
)

MIGRATIONS_DIR="$(dirname "$0")/../prisma/migrations"

echo "📦 Application des migrations..."
echo ""

for migration in "${MIGRATIONS[@]}"; do
    migration_path="$MIGRATIONS_DIR/$migration"
    
    if [ ! -f "$migration_path" ]; then
        echo "⚠️  Migration $migration introuvable, on continue..."
        continue
    fi
    
    echo "   → Application de $migration..."
    
    # Appliquer la migration via gcloud sql connect
    # Note: gcloud sql connect ouvre une session interactive, donc on utilise plutôt psql directement
    # si Cloud SQL Proxy est disponible, ou on affiche les instructions
    
    echo "   📝 Pour appliquer cette migration, exécutez :"
    echo "      psql -h [HOST] -U $USER -d $DATABASE -f $migration_path"
    echo ""
done

echo "✅ Instructions affichées"
echo ""
echo "📋 Pour appliquer les migrations, vous avez deux options :"
echo ""
echo "Option 1 : Via Cloud SQL Proxy (recommandé)"
echo "   1. Télécharger Cloud SQL Proxy :"
echo "      curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64"
echo "      chmod +x cloud-sql-proxy"
echo ""
echo "   2. Démarrer le proxy dans un terminal :"
echo "      ./cloud-sql-proxy $PROJECT_ID:$REGION:$INSTANCE"
echo ""
echo "   3. Dans un autre terminal, appliquer les migrations :"
for migration in "${MIGRATIONS[@]}"; do
    migration_path="$MIGRATIONS_DIR/$migration"
    if [ -f "$migration_path" ]; then
        echo "      psql -h localhost -U $USER -d $DATABASE -f $migration_path"
    fi
done
echo ""
echo "Option 2 : Via gcloud sql connect"
echo "   $GCLOUD_CMD sql connect $INSTANCE --user=$USER --database=$DATABASE --project=$PROJECT_ID"
echo "   Puis copier-coller le contenu de chaque fichier de migration"
echo ""
