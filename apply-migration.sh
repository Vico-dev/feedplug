#!/bin/bash
# Script pour appliquer la migration Prisma marketing_leads

set -e

echo "🗄️  Application de la migration Prisma pour marketing_leads..."

# Option 1: Utiliser Prisma Migrate (recommandé si vous avez déjà des migrations)
if [ -f "prisma/migrations/add_marketing_leads.sql" ]; then
    echo "📋 Migration SQL trouvée dans prisma/migrations/add_marketing_leads.sql"
    echo "⚠️  Veuillez exécuter cette migration manuellement dans votre base de données PostgreSQL"
    echo ""
    echo "Méthode 1: Via psql"
    echo "  psql -h YOUR_DB_HOST -U YOUR_USER -d feedplug -f prisma/migrations/add_marketing_leads.sql"
    echo ""
    echo "Méthode 2: Via Cloud SQL Proxy"
    echo "  cloud_sql_proxy -instances=feedplug-prod:europe-west1:feedplug-db=tcp:5432"
    echo "  psql -h localhost -U feedplug_user -d feedplug -f prisma/migrations/add_marketing_leads.sql"
    echo ""
    echo "Méthode 3: Via Prisma Migrate Deploy (si vous utilisez les migrations Prisma)"
    echo "  DATABASE_URL='your-connection-string' npx prisma migrate deploy --schema=./prisma/schema.prisma"
fi

# Option 2: Utiliser Prisma Migrate Deploy directement
echo ""
echo "🔄 Tentative avec Prisma Migrate Deploy..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL n'est pas défini. Veuillez le définir:"
    echo "   export DATABASE_URL='postgresql://user:password@host:5432/database'"
    exit 1
fi

npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "✅ Migration appliquée avec succès !"



