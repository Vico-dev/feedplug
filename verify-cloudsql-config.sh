#!/bin/bash
# Script pour vérifier la configuration Cloud SQL

PROJECT_ID="feedplug-prod"
INSTANCE="feedplug-db"
REGION="europe-west1"

echo "🔍 Vérification de la configuration Cloud SQL"
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

echo "1. Vérification de l'IP publique de l'instance..."
IP=$($GCLOUD_CMD sql instances describe "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --format="value(ipAddresses[0].ipAddress)" 2>/dev/null)

if [ -z "$IP" ]; then
    echo "   ❌ Impossible de récupérer l'IP"
    echo "   📝 Vérifiez que l'instance existe et autorise les connexions publiques"
else
    echo "   ✅ IP publique : $IP"
fi
echo ""

echo "2. Vérification des réseaux autorisés..."
$GCLOUD_CMD sql instances describe "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --format="value(settings.ipConfiguration.authorizedNetworks)" 2>/dev/null | head -5
echo ""

echo "3. Vérification de l'activation des connexions publiques..."
PUBLIC_IP=$($GCLOUD_CMD sql instances describe "${INSTANCE}" \
  --project="${PROJECT_ID}" \
  --format="value(settings.ipConfiguration.ipv4Enabled)" 2>/dev/null)

if [ "$PUBLIC_IP" = "True" ]; then
    echo "   ✅ Connexions publiques activées"
else
    echo "   ⚠️  Connexions publiques désactivées"
    echo "   📝 Il faut activer les connexions publiques ou utiliser Unix socket"
fi
echo ""

echo "💡 Solutions possibles :"
echo ""
echo "Option 1 : Activer les connexions publiques et autoriser Cloud Run"
echo "   $GCLOUD_CMD sql instances patch ${INSTANCE} \\"
echo "     --project=${PROJECT_ID} \\"
echo "     --authorized-networks=0.0.0.0/0"
echo ""
echo "Option 2 : Utiliser Unix socket (recommandé pour Cloud Run)"
echo "   Il faut utiliser le format Prisma spécial pour Unix socket"
echo "   DATABASE_URL=postgresql://user:pass@localhost:5432/db?host=/cloudsql/PROJECT:REGION:INSTANCE"

