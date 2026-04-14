#!/bin/bash
# Rollback du backend Cloud Run vers la révision précédente (prod cassée après deploy)
set -e
cd "$(dirname "$0")"

PROJECT="feedplug-prod"
REGION="europe-west1"
SERVICE="feedplug-backend-marketing"

GCLOUD=""
if command -v gcloud &>/dev/null; then GCLOUD="gcloud"; fi
if [ -z "$GCLOUD" ] && [ -x "$HOME/google-cloud-sdk/bin/gcloud" ]; then GCLOUD="$HOME/google-cloud-sdk/bin/gcloud"; fi
if [ -z "$GCLOUD" ]; then echo "❌ gcloud introuvable"; exit 1; fi

$GCLOUD config set project $PROJECT --quiet

echo "📋 Révisions récentes (la plus récente = celle déployée aujourd'hui) :"
$GCLOUD run revisions list \
  --service=$SERVICE \
  --region=$REGION \
  --format="table(name.basename(),status.conditions[0].status,metadata.creationTimestamp)" \
  --sort-by="~metadata.creationTimestamp" \
  --limit=5

echo ""
echo "🔄 Redirection du trafic vers la 2e révision (avant le dernier deploy)..."
REVISIONS=($($GCLOUD run revisions list --service=$SERVICE --region=$REGION --format="value(name.basename())" --sort-by="~metadata.creationTimestamp" --limit=2))
PREVIOUS="${REVISIONS[1]}"
if [ -z "$PREVIOUS" ]; then
  echo "❌ Impossible de trouver une révision précédente."
  exit 1
fi
echo "   Révision cible: $PREVIOUS"
$GCLOUD run services update-traffic $SERVICE \
  --to-revisions="${PREVIOUS}=100" \
  --region=$REGION \
  --project=$PROJECT

echo "✅ Rollback terminé. Le backend utilise maintenant la révision $PREVIOUS."
echo "   Vérifiez dans 1 min : curl https://feedplug-backend-marketing-771607738477.europe-west1.run.app/health"
