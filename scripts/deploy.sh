#!/bin/bash

# 🚀 Script de déploiement FeedPlug
echo "🚀 Déploiement de FeedPlug..."

# Vérifier les paramètres
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <environment> [version]"
    echo "   environment: staging|production"
    echo "   version: tag de version (optionnel)"
    exit 1
fi

ENVIRONMENT=$1
VERSION=${2:-latest}

echo "📋 Environnement: $ENVIRONMENT"
echo "📋 Version: $VERSION"

# Vérifier que gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez installer Docker d'abord."
    exit 1
fi

echo "✅ Prérequis vérifiés"

# Configuration selon l'environnement
if [ "$ENVIRONMENT" = "production" ]; then
    PROJECT_ID=${GCP_PROJECT_ID_PROD}
    REGION="europe-west1"
    SERVICE_NAME="feedplug-api-production"
    DB_INSTANCE="feedplug-production-db"
elif [ "$ENVIRONMENT" = "staging" ]; then
    PROJECT_ID=${GCP_PROJECT_ID_STAGING}
    REGION="europe-west1"
    SERVICE_NAME="feedplug-api-staging"
    DB_INSTANCE="feedplug-staging-db"
else
    echo "❌ Environnement non supporté: $ENVIRONMENT"
    exit 1
fi

echo "🔧 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"

# Se connecter à Google Cloud
echo "🔐 Connexion à Google Cloud..."
gcloud config set project $PROJECT_ID
gcloud auth configure-docker

# Build de l'image Docker
echo "🐳 Build de l'image Docker..."
docker build -t gcr.io/$PROJECT_ID/feedplug-api:$VERSION .
docker build -t gcr.io/$PROJECT_ID/feedplug-api:latest .

# Push de l'image
echo "📤 Push de l'image..."
docker push gcr.io/$PROJECT_ID/feedplug-api:$VERSION
docker push gcr.io/$PROJECT_ID/feedplug-api:latest

# Déploiement sur Cloud Run
echo "🚀 Déploiement sur Cloud Run..."
# NOTE: --allow-unauthenticated est requis car le frontend appelle directement l'API.
# L'authentification est gérée au niveau applicatif (JWT).
# Recommandation: Ajouter Cloud Armor en frontal pour la protection DDoS/WAF.
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/feedplug-api:$VERSION \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=$ENVIRONMENT \
  --update-secrets DATABASE_URL=database-url-marketing:latest,JWT_SECRET=jwt-secret:latest,SECRET_ENCRYPTION_KEY=secret-encryption-key:latest \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 100 \
  --min-instances 1

# Exécution des migrations
echo "🗄️ Exécution des migrations..."
gcloud run jobs create feedplug-migrate-$ENVIRONMENT \
  --image gcr.io/$PROJECT_ID/feedplug-api:$VERSION \
  --region $REGION \
  --set-env-vars NODE_ENV=$ENVIRONMENT \
  --command npx \
  --args prisma,migrate,deploy \
  --memory 1Gi \
  --cpu 1

# Exécution du job de migration
gcloud run jobs execute feedplug-migrate-$ENVIRONMENT --region $REGION

# Nettoyage des anciens jobs
gcloud run jobs delete feedplug-migrate-$ENVIRONMENT --region $REGION --quiet

echo ""
echo "🎉 Déploiement terminé avec succès!"
echo ""
echo "🔗 URLs:"
echo "   Service: https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app"
echo "   Documentation: https://$SERVICE_NAME-$REGION-$PROJECT_ID.a.run.app/api/docs"
echo ""
echo "📊 Monitoring:"
echo "   Logs: gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME' --limit 50"
echo "   Métriques: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics"
