#!/bin/bash
# Script pour vérifier les logs du backend et identifier l'erreur Prisma

echo "🔍 Vérification des logs du backend..."
echo ""

PROJECT_ID="feedplug-prod"
SERVICE="feedplug-backend-marketing"
REGION="europe-west1"

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
    echo "📝 Consultez les logs via la console :"
    echo "   https://console.cloud.google.com/run/detail/${REGION}/${SERVICE}/logs?project=${PROJECT_ID}"
    echo ""
    echo "Recherchez les lignes contenant :"
    echo "   - 'Prisma initialization error'"
    echo "   - 'Error details'"
    echo "   - 'Database connection test failed'"
    exit 1
fi

echo "📋 Derniers logs du backend (recherche des erreurs Prisma)..."
echo ""

$GCLOUD_CMD run services logs read "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  | grep -i -E "(prisma|database|error|connection|initialization)" \
  | head -30

echo ""
echo "✅ Analyse terminée"
echo ""
echo "💡 Si vous voyez des erreurs, les causes possibles sont :"
echo "   1. La base de données 'feedplug_marketing' n'existe pas"
echo "   2. Le mot de passe est incorrect"
echo "   3. La connexion Unix socket ne fonctionne pas"
echo "   4. Les permissions Cloud SQL ne sont pas correctes"

