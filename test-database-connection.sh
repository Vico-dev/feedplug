#!/bin/bash
# Script pour tester la connexion à la base de données

echo "🔍 Test de diagnostic de la base de données FeedPlug"
echo ""

BACKEND_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app"

echo "1. Test du endpoint health..."
curl -s "${BACKEND_URL}/api/v1/health" | python3 -m json.tool 2>/dev/null || curl -s "${BACKEND_URL}/api/v1/health"
echo ""
echo ""

echo "2. Test du endpoint diagnostic..."
curl -s "${BACKEND_URL}/api/v1/diagnostic" | python3 -m json.tool 2>/dev/null || curl -s "${BACKEND_URL}/api/v1/diagnostic"
echo ""
echo ""

echo "✅ Tests terminés"
echo ""
echo "📝 Si prismaReady est false, vérifiez :"
echo "   - Que la base de données feedplug_marketing existe"
echo "   - Que le mot de passe est correct"
echo "   - Que les migrations ont été appliquées"
echo "   - Les logs Cloud Run pour plus de détails"

