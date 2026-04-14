#!/bin/bash
# Déploie le backend-marketing sur Cloud Run (GCP)
# À lancer depuis la racine du projet : ./deploy-backend-marketing.sh

set -e
cd "$(dirname "$0")"

# gcloud dans le PATH ou SDK utilisateur
if command -v gcloud &>/dev/null; then
  GCLOUD="gcloud"
elif [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"
elif [ -x "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
  GCLOUD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
else
  echo "❌ gcloud introuvable. Installez le SDK ou ajoutez-le au PATH."
  exit 1
fi

PROJECT_ID="feedplug-prod"

echo "📦 Déploiement backend-marketing vers Cloud Run"
echo "   Projet: $PROJECT_ID"
echo ""

$GCLOUD config set project $PROJECT_ID
$GCLOUD builds submit \
  --config=cloudbuild-backend-marketing.yaml \
  .

echo ""
echo "✅ Déploiement lancé. Vérifiez le statut dans la console GCP > Cloud Build > History"
