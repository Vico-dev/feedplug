#!/bin/bash
# Script pour appliquer directement les migrations SQL via l'API du backend

echo "🔧 Application des migrations SQL via le backend"
echo ""

BACKEND_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app"

echo "1. Test de connexion..."
curl -s "${BACKEND_URL}/api/v1/health" | python3 -m json.tool 2>/dev/null | grep -E "(status|prismaReady)"
echo ""

echo "2. Vérification du diagnostic..."
curl -s "${BACKEND_URL}/api/v1/diagnostic" | python3 -m json.tool 2>/dev/null | head -20
echo ""

echo "💡 Si prismaReady est false, les migrations doivent être appliquées manuellement"
echo ""
echo "📝 Pour appliquer les migrations, utilisez Cloud SQL Proxy :"
echo ""
echo "   Terminal 1 :"
echo "   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64"
echo "   chmod +x cloud-sql-proxy"
echo "   ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db"
echo ""
echo "   Terminal 2 :"
echo "   cd backend-marketing/prisma/migrations"
echo "   psql -h localhost -U feedplug_user -d feedplug_marketing -f 002_ingestion_models.sql"

