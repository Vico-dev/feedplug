#!/bin/bash
# Script d'application de la migration pour l'historique d'enrichissement
# Usage: ./apply-enrichment-migration.sh

set -e

INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
PROJECT="feedplug-prod"
REGION="europe-west1"
MIGRATION_FILE="backend-marketing/prisma/migrations/008_enrichment_history.sql"

echo "📋 Application de la migration Enrichment History..."

# Vérifier que le fichier de migration existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Fichier de migration introuvable: $MIGRATION_FILE"
    exit 1
fi

echo "🔧 Application de la migration via Cloud SQL Proxy..."
echo "   Instance: $INSTANCE"
echo "   Database: $DATABASE"
echo "   User: $USER"
echo ""

# Vérifier si cloud-sql-proxy est disponible
CLOUD_SQL_PROXY="./cloud-sql-proxy"
if [ ! -f "$CLOUD_SQL_PROXY" ]; then
    CLOUD_SQL_PROXY="cloud-sql-proxy"
    if ! command -v $CLOUD_SQL_PROXY &> /dev/null; then
        echo "❌ cloud-sql-proxy non trouvé"
        echo "📝 Veuillez télécharger cloud-sql-proxy ou utiliser gcloud sql connect"
        exit 1
    fi
fi

# Vérifier si psql est disponible
if ! command -v psql &> /dev/null; then
    echo "❌ psql non trouvé"
    echo "📝 Veuillez installer PostgreSQL client"
    exit 1
fi

echo "⚠️  Cette opération nécessite que Cloud SQL Proxy soit démarré"
echo "   Si ce n'est pas le cas, démarrez-le dans un autre terminal :"
echo "   $CLOUD_SQL_PROXY $PROJECT:$REGION:$INSTANCE"
echo ""
read -p "Appuyez sur Entrée pour continuer (ou Ctrl+C pour annuler)... "

# Appliquer la migration
echo "📦 Application de la migration..."
PGPASSWORD="${PGPASSWORD:-}" psql -h localhost -U "$USER" -d "$DATABASE" -f "$MIGRATION_FILE" || {
    echo ""
    echo "❌ Erreur lors de l'application de la migration"
    echo ""
    echo "💡 Vérifiez que :"
    echo "   1. Cloud SQL Proxy est démarré : $CLOUD_SQL_PROXY $PROJECT:$REGION:$INSTANCE"
    echo "   2. La variable PGPASSWORD est définie avec le mot de passe de $USER"
    echo "   3. psql peut se connecter à localhost:5432"
    exit 1
}

echo ""
echo "✅ Migration appliquée avec succès !"
echo ""
echo "📝 Les tables suivantes ont été créées :"
echo "   - EnrichmentHistory (historique des enrichissements)"
echo "   - EnrichmentStats (statistiques d'enrichissement)"
echo ""
echo "🎉 Le système d'enrichissement est maintenant pleinement opérationnel !"

