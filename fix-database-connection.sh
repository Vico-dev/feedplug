#!/bin/bash
# Script pour créer/vérifier la base de données et appliquer les migrations

set -e

PROJECT_ID="feedplug-prod"
INSTANCE="feedplug-db"
DATABASE="feedplug_marketing"
USER="feedplug_user"
REGION="europe-west1"

echo "🔧 Configuration de la base de données FeedPlug"
echo ""

# Trouver gcloud
GCLOUD_CMD=""
if command -v gcloud &> /dev/null; then
    GCLOUD_CMD="gcloud"
elif [ -f "/Users/victorsoldet/google-cloud-sdk/bin/gcloud" ]; then
    GCLOUD_CMD="/Users/victorsoldet/google-cloud-sdk/bin/gcloud"
fi

if [ -z "$GCLOUD_CMD" ]; then
    echo "❌ gcloud n'est pas disponible"
    exit 1
fi

echo "1. Vérification de l'instance Cloud SQL..."
INSTANCE_EXISTS=$($GCLOUD_CMD sql instances describe "${INSTANCE}" --project="${PROJECT_ID}" 2>&1 | grep -q "name:" && echo "yes" || echo "no")

if [ "$INSTANCE_EXISTS" = "no" ]; then
    echo "   ❌ L'instance ${INSTANCE} n'existe pas"
    echo "   📝 Créez-la d'abord via la console ou Terraform"
    exit 1
fi

echo "   ✅ Instance ${INSTANCE} existe"
echo ""

echo "2. Vérification de la base de données ${DATABASE}..."
DB_EXISTS=$($GCLOUD_CMD sql databases list --instance="${INSTANCE}" --project="${PROJECT_ID}" --format="value(name)" | grep -q "^${DATABASE}$" && echo "yes" || echo "no")

if [ "$DB_EXISTS" = "no" ]; then
    echo "   ⚠️  La base de données ${DATABASE} n'existe pas"
    echo "   📝 Création de la base de données..."
    $GCLOUD_CMD sql databases create "${DATABASE}" \
      --instance="${INSTANCE}" \
      --project="${PROJECT_ID}"
    echo "   ✅ Base de données créée"
else
    echo "   ✅ Base de données ${DATABASE} existe"
fi
echo ""

echo "3. Vérification de l'utilisateur ${USER}..."
USER_EXISTS=$($GCLOUD_CMD sql users list --instance="${INSTANCE}" --project="${PROJECT_ID}" --format="value(name)" | grep -q "^${USER}$" && echo "yes" || echo "no")

if [ "$USER_EXISTS" = "no" ]; then
    echo "   ⚠️  L'utilisateur ${USER} n'existe pas"
    echo "   📝 Création de l'utilisateur..."
    echo "   ⚠️  Vous devrez entrer un mot de passe"
    # IMPORTANT: Utiliser un mot de passe fort. Récupérer depuis Secret Manager:
    # gcloud secrets versions access latest --secret=feedplug-db-password
    DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 32)}
    $GCLOUD_CMD sql users create "${USER}" \
      --instance="${INSTANCE}" \
      --password="${DB_PASSWORD}" \
      --project="${PROJECT_ID}"
    echo "   ✅ Utilisateur créé (mot de passe généré aléatoirement si non fourni via DB_PASSWORD)"
    echo "   ⚠️  IMPORTANT: Stockez ce mot de passe dans Secret Manager !"
else
    echo "   ✅ Utilisateur ${USER} existe"
    echo "   📝 Vérification/réinitialisation du mot de passe..."
    DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 32)}
    $GCLOUD_CMD sql users set-password "${USER}" \
      --instance="${INSTANCE}" \
      --password="${DB_PASSWORD}" \
      --project="${PROJECT_ID}"
    echo "   ✅ Mot de passe mis à jour"
fi
echo ""

echo "4. Vérification de la connexion Cloud SQL pour Cloud Run..."
echo "   📝 Pour appliquer les migrations, utilisez Cloud SQL Proxy :"
echo ""
echo "   Terminal 1 :"
echo "   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64"
echo "   chmod +x cloud-sql-proxy"
echo "   ./cloud-sql-proxy ${PROJECT_ID}:${REGION}:${INSTANCE}"
echo ""
echo "   Terminal 2 :"
echo "   cd backend-marketing/prisma/migrations"
echo "   psql -h localhost -U ${USER} -d ${DATABASE} -f 001_create_marketing_leads.sql"
echo "   psql -h localhost -U ${USER} -d ${DATABASE} -f 002_ingestion_models.sql"
echo ""

echo "✅ Configuration de base terminée"
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Appliquez les migrations SQL (voir ci-dessus)"
echo "   2. Redéployez le backend : ./deploy-backend-marketing.sh"
echo "   3. Testez : curl https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/diagnostic"

