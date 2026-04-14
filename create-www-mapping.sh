#!/bin/bash

echo "🚀 Création du mapping de domaine pour www.feedplug.com..."

/Users/victorsoldet/google-cloud-sdk/bin/gcloud beta run domain-mappings create \
  --service feedplug-frontend \
  --domain www.feedplug.com \
  --region europe-west1 \
  --project feedplug-prod

echo ""
echo "✅ Mapping créé !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Configure le DNS CNAME chez ton registrar :"
echo "   Nom: www"
echo "   Type: CNAME"
echo "   Valeur: ghs.googlehosted.com"
echo ""
echo "2. Attends la propagation DNS (15 minutes à quelques heures)"
echo ""
echo "3. Le certificat SSL sera émis automatiquement une fois le DNS propagé"
echo ""
echo "4. Vérifie l'état avec :"
echo "   gcloud beta run domain-mappings describe www.feedplug.com --region europe-west1 --project feedplug-prod"


