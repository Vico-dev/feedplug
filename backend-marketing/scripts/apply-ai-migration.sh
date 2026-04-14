#!/bin/bash
# Script d'application de la migration pour la gestion IA
# Usage: ./apply-ai-migration.sh [PASSWORD]

set -e

INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
PROJECT="feedplug-prod"
REGION="europe-west1"

echo "📋 Application de la migration AI Management..."

if [ -z "$1" ]; then
    echo "❌ Mot de passe requis"
    echo "Usage: $0 [PASSWORD]"
    echo ""
    echo "Alternative: via Cloud SQL Proxy:"
    echo "  cloud-sql-proxy $PROJECT:$REGION:$INSTANCE"
    echo "  psql -h localhost -U $USER -d $DATABASE -f backend-marketing/prisma/migrations/005_ai_management.sql"
    exit 1
fi

PASSWORD="$1"

echo "🔧 Exécution de la migration..."

gcloud sql connect $INSTANCE \
  --user=$USER \
  --database=$DATABASE \
  --project=$PROJECT <<EOF
$(cat backend-marketing/prisma/migrations/005_ai_management.sql)
EOF

echo "✅ Migration appliquée avec succès !"
echo ""
echo "📝 Prochaines étapes:"
echo "1. Configurer une clé API Gemini via l'interface d'administration"
echo "2. Les fonctions d'optimisation utiliseront automatiquement le cache"






