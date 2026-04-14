#!/bin/bash
# Déploiement : migration 021 (historique score) + backend + frontend sur GCP
# À lancer depuis la racine du projet, avec gcloud connecté.
#
# Usage :
#   cd /Users/victorsoldet/Desktop/Feedplug
#   chmod +x deploy-score-history-and-app.sh
#   ./deploy-score-history-and-app.sh
#
# Optionnel : pour appliquer la migration 021, exporte le mot de passe puis relance le script avec MIGRATE=1 :
#   export PGPASSWORD="<mot-de-passe-depuis-secret-manager>"
#   MIGRATE=1 ./deploy-score-history-and-app.sh

set -e
cd "$(dirname "$0")"

GCLOUD=""
if command -v gcloud &>/dev/null; then
  GCLOUD="gcloud"
elif [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
elif [ -x "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
fi

if [ -z "$GCLOUD" ]; then
  echo "❌ gcloud introuvable. Installez le SDK ou ajoutez-le au PATH."
  exit 1
fi

PROJECT="feedplug-prod"
$GCLOUD config set project $PROJECT --quiet

# 1) Migration 021 (optionnel si PGPASSWORD ou Secret Manager accessible)
if [ -n "$MIGRATE" ]; then
  echo "📦 Application de la migration 021_product_score_history.sql..."
  if [ -x "./backend-marketing/scripts/run-migrations-one-shot.sh" ]; then
    ./backend-marketing/scripts/run-migrations-one-shot.sh
  else
    echo "   Lance manuellement : PGPASSWORD=xxx ./backend-marketing/scripts/run-migrations-one-shot.sh"
  fi
  echo ""
fi

# 2) Backend
echo "📦 Déploiement backend-marketing vers Cloud Run..."
$GCLOUD builds submit --config=cloudbuild-backend-marketing.yaml .
echo "✅ Backend déployé."
echo ""

# 3) Frontend
echo "📦 Déploiement frontend..."
cd frontend
$GCLOUD run deploy feedplug-frontend \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_API_URL=https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1,NEXT_PUBLIC_GOOGLE_CLIENT_ID=771607738477-iam4qts7ch3sn9do88djdkohvpj0f4a9.apps.googleusercontent.com" \
  --project $PROJECT \
  --clear-base-image
cd ..
echo "✅ Frontend déployé."
echo ""
echo "🎉 Déploiement terminé."
echo "   Pour activer l’historique du score : applique la migration 021 si pas encore fait (voir DEPLOI_GCP.md)."
