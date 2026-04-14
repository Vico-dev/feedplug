#!/bin/bash

# ===== SCRIPT DE SETUP DOCKER POUR FEEDPLUG =====

set -e

echo "🐳 Configuration de FeedPlug avec Docker..."

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    error "Docker n'est pas installé. Veuillez installer Docker Desktop."
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose n'est pas installé. Veuillez installer Docker Compose."
fi

log "Vérification de Docker..."
docker --version
docker-compose --version

# Créer le fichier .env s'il n'existe pas (template : env.example)
if [ ! -f .env ]; then
    log "Création du fichier .env à partir de env.example..."
    cp env.example .env
    warning "Fichier .env créé. Veuillez le modifier avec vos vraies valeurs."
fi

# Créer les répertoires nécessaires
log "Création des répertoires..."
mkdir -p logs
mkdir -p ssl

# Arrêter les conteneurs existants
log "Arrêt des conteneurs existants..."
docker-compose down --remove-orphans || true

# Construire et démarrer les services
log "Construction et démarrage des services..."
docker-compose up --build -d

# Attendre que PostgreSQL soit prêt
log "Attente de PostgreSQL..."
timeout=60
while ! docker-compose exec -T postgres pg_isready -U feedplug -d feedplug; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        error "Timeout: PostgreSQL n'est pas prêt"
    fi
done

# Attendre que Redis soit prêt
log "Attente de Redis..."
timeout=30
while ! docker-compose exec -T redis redis-cli ping; do
    sleep 2
    timeout=$((timeout - 2))
    if [ $timeout -le 0 ]; then
        error "Timeout: Redis n'est pas prêt"
    fi
done

# Exécuter les migrations Prisma
log "Exécution des migrations Prisma..."
docker-compose exec app npx prisma migrate deploy

# Générer le client Prisma
log "Génération du client Prisma..."
docker-compose exec app npx prisma generate

# Seed de la base de données
log "Seed de la base de données..."
docker-compose exec app npx prisma db seed

# Vérifier la santé de l'application
log "Vérification de la santé de l'application..."
timeout=60
while ! curl -f http://localhost:3000/health 2>/dev/null; do
    sleep 5
    timeout=$((timeout - 5))
    if [ $timeout -le 0 ]; then
        error "Timeout: L'application n'est pas prête"
    fi
done

success "🎉 FeedPlug est prêt !"
echo ""
echo "📡 Services disponibles :"
echo "   • Application: http://localhost:3000"
echo "   • Documentation API: http://localhost:3000/api/docs"
echo "   • PgAdmin: http://localhost:5050 (admin@feedplug.com / admin123)"
echo "   • Redis Commander: http://localhost:8081"
echo ""
echo "🔧 Commandes utiles :"
echo "   • Voir les logs: docker-compose logs -f app"
echo "   • Arrêter: docker-compose down"
echo "   • Redémarrer: docker-compose restart app"
echo "   • Accès shell: docker-compose exec app sh"
echo ""
echo "📊 Base de données :"
echo "   • Host: localhost:5432"
echo "   • Database: feedplug"
echo "   • User: feedplug"
echo "   • Password: feedplug123"
echo ""
echo "🔴 Redis :"
echo "   • Host: localhost:6379"
echo "   • Password: feedplug123"
