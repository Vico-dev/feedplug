#!/bin/bash
# Script pour mettre à jour les sources avec l'URL CSV et créer les flux manquants

BACKEND_URL="https://feedplug-backend-marketing-771607738477.europe-west1.run.app"
CSV_URL="https://feedconvertor.madmetrics.com/feed/419/15"

echo "🔧 Mise à jour des sources et création des flux..."
echo ""

# Attendre que Prisma soit prêt
echo "⏳ Attente de l'initialisation de Prisma..."
for i in {1..30}; do
  PRISMA_READY=$(curl -s "${BACKEND_URL}/api/v1/health" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('prismaReady', False))" 2>/dev/null)
  if [ "$PRISMA_READY" = "True" ]; then
    echo "✅ Prisma est prêt !"
    break
  fi
  echo "  Tentative $i/30..."
  sleep 2
done

# Récupérer les sources
echo ""
echo "📋 Récupération des sources..."
SOURCES=$(curl -s "${BACKEND_URL}/api/v1/ingestion/sources")

# Mettre à jour chaque source avec l'URL CSV
echo "$SOURCES" | python3 -c "
import sys, json
sources = json.load(sys.stdin)
import subprocess
import os

for source in sources:
    if source.get('connector') == 'CSV':
        source_id = source['id']
        source_name = source['name']
        print(f'🔧 Mise à jour de la source: {source_name} ({source_id})')
        
        # Mettre à jour la source avec l'URL CSV
        result = subprocess.run([
            'curl', '-s', '-X', 'PUT',
            f'${BACKEND_URL}/api/v1/ingestion/sources/{source_id}',
            '-H', 'Content-Type: application/json',
            '-d', json.dumps({'configJson': {'csvUrl': '${CSV_URL}'}})
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f'  ✅ Source {source_name} mise à jour')
        else:
            print(f'  ❌ Erreur: {result.stderr}')
"

# Créer les flux manquants
echo ""
echo "📦 Création des flux manquants..."
CREATE_RESULT=$(curl -s -X POST "${BACKEND_URL}/api/v1/ingestion/create-missing-feeds")
echo "$CREATE_RESULT" | python3 -m json.tool

echo ""
echo "✅ Terminé !"

