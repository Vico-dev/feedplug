#!/bin/bash

# Script pour créer/mettre à jour le job Cloud Scheduler pour les mises à jour automatiques

set -e

PROJECT_ID="feedplug-prod"
REGION="europe-west1"
SERVICE_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/ingestion/scheduled-runs"
JOB_NAME="feedplug-scheduled-ingestion"
SCHEDULE="0 * * * *"  # Toutes les heures à la minute 0
MARKETING_SERVICE_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/marketing/nurture-runs"
MARKETING_JOB_NAME="feedplug-marketing-nurture"
MARKETING_SCHEDULE="15 * * * *"  # Toutes les heures à la minute 15
EXPORTS_SERVICE_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/exports/scheduled-runs"
EXPORTS_JOB_NAME="feedplug-scheduled-exports"
EXPORTS_SCHEDULE="30 * * * *"  # Toutes les heures à la minute 30
TIMEZONE="Europe/Paris"
SCHEDULER_SECRET_NAME="scheduler-secret"

# Trouver gcloud
if command -v gcloud &> /dev/null; then
    GCLOUD_CMD="gcloud"
elif [ -f "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD_CMD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
else
    echo "❌ gcloud non trouvé. Veuillez installer Google Cloud SDK."
    exit 1
fi

echo "🔧 Configuration du Cloud Scheduler pour les mises à jour automatiques..."

echo "🔐 Lecture du secret scheduler..."
SCHEDULER_SECRET=$($GCLOUD_CMD secrets versions access latest --secret=$SCHEDULER_SECRET_NAME --project=$PROJECT_ID)

# Activer l'API Cloud Scheduler si nécessaire
echo "🔌 Activation de l'API Cloud Scheduler..."
$GCLOUD_CMD services enable cloudscheduler.googleapis.com --project=$PROJECT_ID || echo "⚠️  L'API Cloud Scheduler est peut-être déjà activée"

# Vérifier si le job existe déjà
if $GCLOUD_CMD scheduler jobs describe $JOB_NAME --location=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo "📝 Mise à jour du job existant..."
    $GCLOUD_CMD scheduler jobs update http $JOB_NAME \
        --location=$REGION \
        --schedule="$SCHEDULE" \
        --uri="$SERVICE_URL" \
        --http-method=POST \
        --update-headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
        --time-zone="$TIMEZONE" \
        --attempt-deadline=600s \
        --description="Mise à jour automatique quotidienne des flux produits" \
        --project=$PROJECT_ID
else
    echo "✨ Création du nouveau job..."
    $GCLOUD_CMD scheduler jobs create http $JOB_NAME \
        --location=$REGION \
        --schedule="$SCHEDULE" \
        --uri="$SERVICE_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
        --time-zone="$TIMEZONE" \
        --attempt-deadline=600s \
        --description="Mise à jour automatique quotidienne des flux produits" \
        --project=$PROJECT_ID
fi

echo "✅ Job Cloud Scheduler configuré avec succès!"

if $GCLOUD_CMD scheduler jobs describe $MARKETING_JOB_NAME --location=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo "📝 Mise à jour du job marketing existant..."
    $GCLOUD_CMD scheduler jobs update http $MARKETING_JOB_NAME \
        --location=$REGION \
        --schedule="$MARKETING_SCHEDULE" \
        --uri="$MARKETING_SERVICE_URL" \
        --http-method=POST \
        --update-headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
        --time-zone="$TIMEZONE" \
        --attempt-deadline=600s \
        --description="Envoi automatique des relances marketing FeedPlug" \
        --project=$PROJECT_ID
else
    echo "✨ Création du job marketing..."
    $GCLOUD_CMD scheduler jobs create http $MARKETING_JOB_NAME \
        --location=$REGION \
        --schedule="$MARKETING_SCHEDULE" \
        --uri="$MARKETING_SERVICE_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
        --time-zone="$TIMEZONE" \
        --attempt-deadline=600s \
        --description="Envoi automatique des relances marketing FeedPlug" \
        --project=$PROJECT_ID
fi

echo "✅ Job marketing configuré avec succès!"

if $GCLOUD_CMD scheduler jobs describe $EXPORTS_JOB_NAME --location=$REGION --project=$PROJECT_ID &> /dev/null; then
    echo "📝 Mise à jour du job exports planifiés existant..."
    $GCLOUD_CMD scheduler jobs update http $EXPORTS_JOB_NAME \
        --location=$REGION \
        --schedule="$EXPORTS_SCHEDULE" \
        --uri="$EXPORTS_SERVICE_URL" \
        --http-method=POST \
        --update-headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
        --time-zone="$TIMEZONE" \
        --attempt-deadline=600s \
        --description="Push automatique quotidien des flux vers GMC/Amazon" \
        --project=$PROJECT_ID
else
    echo "✨ Création du job exports planifiés..."
    $GCLOUD_CMD scheduler jobs create http $EXPORTS_JOB_NAME \
        --location=$REGION \
        --schedule="$EXPORTS_SCHEDULE" \
        --uri="$EXPORTS_SERVICE_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
        --time-zone="$TIMEZONE" \
        --attempt-deadline=600s \
        --description="Push automatique quotidien des flux vers GMC/Amazon" \
        --project=$PROJECT_ID
fi

echo "✅ Job exports planifiés configuré avec succès!"
echo ""
echo "📋 Détails du job:"
echo "   - Nom: $JOB_NAME"
echo "   - Horaire: $SCHEDULE (toutes les heures)"
echo "   - Fuseau horaire: $TIMEZONE"
echo "   - URL: $SERVICE_URL"
echo "   - Job marketing: $MARKETING_JOB_NAME"
echo "   - Horaire marketing: $MARKETING_SCHEDULE"
echo "   - URL marketing: $MARKETING_SERVICE_URL"
echo "   - Job exports: $EXPORTS_JOB_NAME"
echo "   - Horaire exports: $EXPORTS_SCHEDULE"
echo "   - URL exports: $EXPORTS_SERVICE_URL"
echo ""
echo "💡 Pour tester le job manuellement:"
echo "   $GCLOUD_CMD scheduler jobs run $JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo "   $GCLOUD_CMD scheduler jobs run $MARKETING_JOB_NAME --location=$REGION --project=$PROJECT_ID"
echo "   $GCLOUD_CMD scheduler jobs run $EXPORTS_JOB_NAME --location=$REGION --project=$PROJECT_ID"
