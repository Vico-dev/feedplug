#!/bin/bash
# Script pour vérifier la structure des tables dans la base de données

PROJECT_ID="feedplug-prod"
INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"

echo "🔍 Vérification de la structure des tables"
echo ""

# Trouver gcloud
GCLOUD_CMD=""
if command -v gcloud &> /dev/null; then
    GCLOUD_CMD="gcloud"
elif [ -f "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD_CMD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
fi

if [ -z "$GCLOUD_CMD" ]; then
    echo "❌ gcloud n'est pas disponible"
    echo ""
    echo "📝 Pour vérifier la structure, connectez-vous à la base de données :"
    echo "   $GCLOUD_CMD sql connect ${INSTANCE} --user=${USER} --database=${DATABASE} --project=${PROJECT_ID}"
    echo ""
    echo "   Puis exécutez :"
    echo "   \\d \"FeedSource\""
    echo "   \\d \"Feed\""
    exit 1
fi

echo "📋 Pour vérifier la structure des tables, exécutez :"
echo ""
echo "   $GCLOUD_CMD sql connect ${INSTANCE} --user=${USER} --database=${DATABASE} --project=${PROJECT_ID}"
echo ""
echo "   Puis dans psql :"
echo "   \\d \"FeedSource\""
echo "   \\d \"Feed\""
echo ""
echo "💡 Le problème est probablement que les colonnes ont des noms différents"
echo "   (par exemple 'configjson' au lieu de 'configJson')"

