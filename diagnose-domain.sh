#!/bin/bash

PROJECT_ID="feedplug-prod"
REGION="europe-west1"
FRONTEND_SERVICE="feedplug-frontend"

echo "🔍 Diagnostic des domaines FeedPlug"
echo "===================================="
echo ""

# 1. Vérifier le service Cloud Run
echo "1️⃣ Vérification du service Cloud Run..."
SERVICE_URL=$(/Users/victorsoldet/google-cloud-sdk/bin/gcloud run services describe ${FRONTEND_SERVICE} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="value(status.url)" 2>/dev/null)

if [ -z "$SERVICE_URL" ]; then
  echo "❌ Le service ${FRONTEND_SERVICE} n'existe pas ou n'est pas accessible"
else
  echo "✅ Service trouvé: ${SERVICE_URL}"
fi
echo ""

# 2. Vérifier les mappings de domaine
echo "2️⃣ Vérification des mappings de domaine..."
echo "Mappings existants:"
/Users/victorsoldet/google-cloud-sdk/bin/gcloud beta run domain-mappings list \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="table(name,metadata.status.conditions[0].status,metadata.status.url)" 2>/dev/null || echo "Aucun mapping trouvé"
echo ""

# 3. Vérifier feedplug.com
echo "3️⃣ Test de feedplug.com..."
curl -I -s https://feedplug.com | head -1 || echo "❌ feedplug.com ne répond pas"
echo ""

# 4. Vérifier www.feedplug.com
echo "4️⃣ Test de www.feedplug.com..."
curl -I -s https://www.feedplug.com | head -1 || echo "❌ www.feedplug.com ne répond pas"
echo ""

# 5. Vérifier app.feedplug.com
echo "5️⃣ Test de app.feedplug.com..."
curl -I -s https://app.feedplug.com | head -1 || echo "❌ app.feedplug.com ne répond pas"
echo ""

# 6. Vérifier le DNS
echo "6️⃣ Vérification DNS..."
echo "feedplug.com DNS:"
dig +short feedplug.com || echo "DNS non résolu"
echo ""
echo "www.feedplug.com DNS:"
dig +short www.feedplug.com || echo "DNS non résolu"
echo ""

echo "✅ Diagnostic terminé"


