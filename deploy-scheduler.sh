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
CASHBACK_SERVICE_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/comparator/internal/cashback/poll"
CASHBACK_JOB_NAME="feedplug-cashback-poll"
CASHBACK_SCHEDULE="15 3,15 * * *"  # Deux fois par jour — conversions AWIN (clickref -> CashbackTransaction)
ALERTS_SERVICE_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/comparator/internal/price-alerts"
ALERTS_JOB_NAME="feedplug-comparator-price-alerts"
ALERTS_SCHEDULE="0 8 * * *"  # Tous les jours à 8h Paris — alertes baisse de prix (watchlist)
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

# Crée ou met à jour un job HTTP authentifié par x-scheduler-secret
upsert_job() {
    local name="$1" schedule="$2" url="$3" desc="$4"
    if $GCLOUD_CMD scheduler jobs describe "$name" --location=$REGION --project=$PROJECT_ID &> /dev/null; then
        echo "📝 Mise à jour du job $name..."
        $GCLOUD_CMD scheduler jobs update http "$name" \
            --location=$REGION \
            --schedule="$schedule" \
            --uri="$url" \
            --http-method=POST \
            --update-headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
            --time-zone="$TIMEZONE" \
            --attempt-deadline=600s \
            --description="$desc" \
            --project=$PROJECT_ID
    else
        echo "✨ Création du job $name..."
        $GCLOUD_CMD scheduler jobs create http "$name" \
            --location=$REGION \
            --schedule="$schedule" \
            --uri="$url" \
            --http-method=POST \
            --headers="Content-Type=application/json,x-scheduler-secret=$SCHEDULER_SECRET" \
            --time-zone="$TIMEZONE" \
            --attempt-deadline=600s \
            --description="$desc" \
            --project=$PROJECT_ID
    fi
}

upsert_job "$CASHBACK_JOB_NAME" "$CASHBACK_SCHEDULE" "$CASHBACK_SERVICE_URL" "Poll des conversions AWIN (cashback comparateur)"
echo "✅ Job cashback configuré avec succès!"

upsert_job "$ALERTS_JOB_NAME" "$ALERTS_SCHEDULE" "$ALERTS_SERVICE_URL" "Alertes baisse de prix (watchlist comparateur)"
echo "✅ Job alertes prix configuré avec succès!"
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
