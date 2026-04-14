#!/bin/bash

# ===== SCRIPT DE DÉVELOPPEMENT POUR FEEDPLUG =====

set -e

echo "🚀 Démarrage de FeedPlug en mode développement..."

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker Desktop."
    exit 1
fi

# Démarrer les services de base (PostgreSQL, Redis)
log "Démarrage des services de base..."
docker-compose up -d postgres redis

# Attendre que les services soient prêts
log "Attente des services..."
sleep 10

# Démarrer l'application en mode développement
log "Démarrage de l'application en mode développement..."
docker-compose up app

success "🎉 FeedPlug en mode développement démarré !"
