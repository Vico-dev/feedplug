#!/bin/bash
# Créer les secrets Stripe dans Google Cloud Secret Manager
# À exécuter avant le déploiement : ./scripts/setup-stripe-secrets.sh

set -e

PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Définis GCP_PROJECT_ID ou configure un projet: gcloud config set project TON_PROJECT_ID"
  exit 1
fi

echo "📦 Projet GCP: $PROJECT_ID"

# Charger les variables depuis .env (à la racine du repo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$REPO_ROOT/.env" ]; then
  export $(grep -E '^STRIPE_SECRET_KEY=|^STRIPE_WEBHOOK_SECRET=' "$REPO_ROOT/.env" | xargs)
fi

if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo "❌ STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET doivent être définis (dans .env ou en variables d'env)"
  exit 1
fi

echo "🔐 Création/mise à jour des secrets Stripe..."

# stripe-secret-key
echo -n "$STRIPE_SECRET_KEY" | gcloud secrets create stripe-secret-key --data-file=- --project=$PROJECT_ID 2>/dev/null || \
  echo -n "$STRIPE_SECRET_KEY" | gcloud secrets versions add stripe-secret-key --data-file=- --project=$PROJECT_ID

# stripe-webhook-secret
echo -n "$STRIPE_WEBHOOK_SECRET" | gcloud secrets create stripe-webhook-secret --data-file=- --project=$PROJECT_ID 2>/dev/null || \
  echo -n "$STRIPE_WEBHOOK_SECRET" | gcloud secrets versions add stripe-webhook-secret --data-file=- --project=$PROJECT_ID

echo "✅ Secrets Stripe configurés. Tu peux déployer."
