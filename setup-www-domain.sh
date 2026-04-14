#!/bin/bash

PROJECT_ID="feedplug-prod"
REGION="europe-west1"
FRONTEND_SERVICE="feedplug-frontend"
DOMAIN="www.feedplug.com"

echo "🚀 Configuration du mapping de domaine pour ${DOMAIN} vers le service ${FRONTEND_SERVICE}"

# Vérifier si le service Cloud Run existe
SERVICE_EXISTS=$(/Users/victorsoldet/google-cloud-sdk/bin/gcloud run services list --project=${PROJECT_ID} --region=${REGION} --filter="metadata.name=${FRONTEND_SERVICE}" --format="value(metadata.name)")

if [ -z "$SERVICE_EXISTS" ]; then
  echo "❌ Erreur : Le service Cloud Run '${FRONTEND_SERVICE}' n'existe pas dans la région '${REGION}' du projet '${PROJECT_ID}'."
  echo "Veuillez vous assurer que le service est déployé avant de mapper le domaine."
  exit 1
fi

echo "✅ Service '${FRONTEND_SERVICE}' trouvé."

# Créer ou mettre à jour le mapping de domaine
echo "Création/Mise à jour du mapping de domaine pour ${DOMAIN}..."
/Users/victorsoldet/google-cloud-sdk/bin/gcloud run domain-mappings create \
  --service ${FRONTEND_SERVICE} \
  --domain ${DOMAIN} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format="yaml"

echo "🎉 Mapping de domaine initié pour ${DOMAIN}."
echo "Veuillez noter les enregistrements DNS affichés ci-dessus et les configurer chez votre registrar."
echo "Le certificat SSL sera émis automatiquement une fois les enregistrements DNS propagés."
echo ""
echo "Pour www.feedplug.com, vous devez créer un enregistrement CNAME :"
echo "  Nom: www"
echo "  Type: CNAME"
echo "  Valeur: ghs.googlehosted.com"
echo ""
echo "Vous pouvez vérifier l'état du mapping avec la commande :"
echo "gcloud run domain-mappings describe ${DOMAIN} --region ${REGION} --project ${PROJECT_ID}"


