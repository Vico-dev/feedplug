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

# Traçabilité git ↔ GCP : on ne déploie que du code COMMITÉ, et on bake le SHA git
# dans l'image + la révision Cloud Run (interrogeable via `gcloud run services describe`).
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "❌ Working tree non commité (fichiers suivis modifiés)."
  echo "   Commit d'abord, sinon GCP ferait tourner un état intraçable."
  echo "   Override d'urgence : ALLOW_DIRTY=1 ./deploy-backend-marketing.sh"
  [ "${ALLOW_DIRTY:-}" = "1" ] || exit 1
  echo "⚠️  ALLOW_DIRTY=1 : déploiement d'un tree sale — le SHA ne reflète pas le code envoyé."
fi
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "   Commit déployé : $GIT_SHA"
echo ""

$GCLOUD config set project $PROJECT_ID
$GCLOUD builds submit \
  --config=cloudbuild-backend-marketing.yaml \
  --substitutions=_GIT_SHA="$GIT_SHA" \
  .

echo ""
echo "✅ Déploiement lancé. Vérifiez le statut dans la console GCP > Cloud Build > History"
