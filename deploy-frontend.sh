#!/bin/bash
# Script de déploiement pour le frontend FeedPlug

set -e

PROJECT_ID="feedplug-prod"
REGION="europe-west1"
FRONTEND_SERVICE="feedplug-frontend"

echo "Deploiement du frontend FeedPlug..."

# Trouver gcloud
GCLOUD_CMD=""
if command -v gcloud &> /dev/null; then
    GCLOUD_CMD="gcloud"
elif [ -f "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD_CMD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
fi

if [ -z "$GCLOUD_CMD" ]; then
    echo "gcloud n'est pas disponible"
    exit 1
fi

FRONTEND_DIR="frontend"
IMAGE_TAG="manual-$(date +%Y%m%d-%H%M%S)"
IMAGE_NAME="gcr.io/$PROJECT_ID/$FRONTEND_SERVICE:$IMAGE_TAG"
BACKEND_API_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="771607738477-iam4qts7ch3sn9do88djdkohvpj0f4a9.apps.googleusercontent.com"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}"
NEXT_PUBLIC_SHOPIFY_API_KEY="${NEXT_PUBLIC_SHOPIFY_API_KEY:-}"

if [ -z "$NEXT_PUBLIC_SHOPIFY_API_KEY" ]; then
    NEXT_PUBLIC_SHOPIFY_API_KEY="$($GCLOUD_CMD secrets versions access latest --secret=shopify-api-key --project "$PROJECT_ID" 2>/dev/null || true)"
fi

echo "Build et deploiement du frontend..."
echo "   Project: $PROJECT_ID"
echo "   Service: $FRONTEND_SERVICE"
echo "   Region: $REGION"
echo "   Image: $IMAGE_NAME"
echo "   Tag: $IMAGE_TAG"

echo "Build + Deploy via cloudbuild-frontend.yaml (bake les NEXT_PUBLIC_* dans le bundle JS)..."
# IMPORTANT : on doit utiliser cloudbuild-frontend.yaml (avec substitutions) au
# lieu de `gcloud builds submit --tag` (qui ne passe pas les build-args). Sans
# le build-arg NEXT_PUBLIC_SHOPIFY_API_KEY, le bundle Next.js ne contient pas
# la clé → App Bridge ne se charge pas → /embedded plante en "shopify is not
# defined".
$GCLOUD_CMD builds submit \
  --config=cloudbuild-frontend.yaml \
  --substitutions=_SHOPIFY_API_KEY="$NEXT_PUBLIC_SHOPIFY_API_KEY" \
  --project="$PROJECT_ID" \
  .

echo "Deploiement termine."
echo "Le service $FRONTEND_SERVICE devrait etre disponible dans quelques minutes."
echo "URL: https://$FRONTEND_SERVICE-771607738477.$REGION.run.app"
