#!/bin/bash
# Attache les secrets Shopify au backend Cloud Run
# À lancer une seule fois (ou après modification des secrets)

set -e
PROJECT_ID="feedplug-prod"
REGION="europe-west1"
SERVICE="feedplug-backend-marketing"

echo "🔗 Attachement des secrets Shopify au service $SERVICE..."

gcloud run services update $SERVICE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-secrets=SHOPIFY_API_KEY=shopify-api-key:latest,SHOPIFY_API_SECRET=shopify-api-secret:latest

echo "✅ Secrets Shopify attachés. Le service va redémarrer avec la nouvelle config."
echo "   Attendez 1-2 min puis testez la connexion Shopify."
