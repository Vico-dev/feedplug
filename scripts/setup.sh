#!/bin/bash

# 🚀 Script de configuration FeedPlug
echo "🚀 Configuration de FeedPlug..."

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez installer Docker d'abord."
    exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez installer Docker Compose d'abord."
    exit 1
fi

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez installer Node.js 18+ d'abord."
    exit 1
fi

echo "✅ Prérequis vérifiés"

# Installer les dépendances npm
echo "📦 Installation des dépendances..."
npm install

# Copier le fichier d'environnement
if [ ! -f .env ]; then
    echo "📝 Création du fichier .env..."
    cp env.example .env
    echo "⚠️  N'oubliez pas de configurer vos variables d'environnement dans .env"
fi

# Démarrer les services Docker
echo "🐳 Démarrage des services Docker..."
docker-compose up -d

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente de PostgreSQL..."
sleep 10

# Générer le client Prisma
echo "🔧 Génération du client Prisma..."
npx prisma generate

# Exécuter les migrations
echo "🗄️ Exécution des migrations..."
npx prisma migrate dev --name init

# Seed la base de données
echo "🌱 Seeding de la base de données..."
npm run prisma:seed

echo ""
echo "🎉 Configuration terminée avec succès!"
echo ""
echo "📋 Comptes de test créés:"
echo "👤 Admin: admin@feedplug.com / admin123"
echo "👤 Demo: demo@feedplug.com / admin123"
echo ""
echo "🔗 URLs utiles:"
echo "🌐 API: http://localhost:3000"
echo "📚 Documentation: http://localhost:3000/api/docs"
echo "🗄️ pgAdmin: http://localhost:5050 (admin@feedplug.com / admin123)"
echo "🔴 Redis Commander: http://localhost:8081"
echo ""
echo "🚀 Pour démarrer l'application:"
echo "npm run start:dev"
echo ""
echo "🛑 Pour arrêter les services:"
echo "docker-compose down"
