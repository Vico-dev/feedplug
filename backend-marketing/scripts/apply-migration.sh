#!/bin/bash
# Script d'application manuelle des migrations marketing (leads + ingestion)
# Usage: ./apply-migration.sh [PASSWORD]

set -e

INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
PROJECT="feedplug-prod"
REGION="europe-west1"

echo "📋 Application des migrations marketing (leads + ingestion)..."

if [ -z "$1" ]; then
    echo "❌ Mot de passe requis"
    echo "Usage: $0 [PASSWORD]"
    echo ""
    echo "Alternative: via Cloud SQL Proxy:"
    echo "  cloud-sql-proxy $PROJECT:$REGION:$INSTANCE"
    echo "  psql -h localhost -U $USER -d $DATABASE -f backend-marketing/prisma/migrations/001_create_marketing_leads.sql"
    echo "  psql -h localhost -U $USER -d $DATABASE -f backend-marketing/prisma/migrations/002_ingestion_models.sql"
    exit 1
fi

PASSWORD="$1"

echo "🔧 Exécution des migrations..."

gcloud sql connect $INSTANCE \
  --user=$USER \
  --database=$DATABASE \
  --project=$PROJECT <<EOF
$(cat backend-marketing/prisma/migrations/001_create_marketing_leads.sql)
$(echo)
$(cat backend-marketing/prisma/migrations/002_ingestion_models.sql)
EOF

echo "✅ Migrations appliquées avec succès !"


