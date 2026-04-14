# 🐳 FeedPlug - Setup Docker

Ce guide vous explique comment utiliser Docker pour développer et déployer FeedPlug.

## 🚀 Démarrage Rapide

### **Option 1 : Setup Automatique (Recommandé)**
```bash
npm run docker:setup
```

### **Option 2 : Setup Manuel**
```bash
# 1. Créer le fichier .env (à partir du template env.example)
cp env.example .env

# 2. Démarrer les services
docker-compose up -d

# 3. Attendre que les services soient prêts
sleep 30

# 4. Exécuter les migrations
docker-compose exec app npx prisma migrate deploy

# 5. Générer le client Prisma
docker-compose exec app npx prisma generate

# 6. Seed la base de données
docker-compose exec app npx prisma db seed
```

## 📡 Services Disponibles

| Service | URL | Description |
|---------|-----|-------------|
| **Application** | http://localhost:3000 | API FeedPlug |
| **Documentation** | http://localhost:3000/api/docs | Swagger UI |
| **PgAdmin** | http://localhost:5050 | Gestion PostgreSQL |
| **Redis Commander** | http://localhost:8081 | Gestion Redis |

### **Identifiants par défaut :**
- **PgAdmin** : admin@feedplug.com / admin123
- **PostgreSQL** : feedplug / feedplug123
- **Redis** : feedplug123

## 🔧 Commandes Utiles

### **Gestion des Conteneurs**
```bash
# Démarrer tous les services
npm run docker:up

# Arrêter tous les services
npm run docker:down

# Voir les logs de l'application
npm run docker:logs

# Redémarrer l'application
docker-compose restart app

# Nettoyer complètement
npm run docker:clean
```

### **Développement**
```bash
# Mode développement avec hot reload
npm run docker:dev

# Accéder au shell du conteneur
npm run docker:shell

# Accéder à PostgreSQL
npm run docker:db

# Accéder à Redis
npm run docker:redis
```

### **Base de Données**
```bash
# Migrations
docker-compose exec app npx prisma migrate dev

# Générer le client Prisma
docker-compose exec app npx prisma generate

# Studio Prisma
docker-compose exec app npx prisma studio

# Seed
docker-compose exec app npx prisma db seed
```

## 🏗️ Architecture Docker

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FeedPlug App  │    │   PostgreSQL    │    │     Redis       │
│   (NestJS)      │◄──►│   (Database)    │    │   (Cache/Queue) │
│   Port: 3000    │    │   Port: 5432    │    │   Port: 6379    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐
│     PgAdmin     │    │ Redis Commander │
│   Port: 5050    │    │   Port: 8081    │
└─────────────────┘    └─────────────────┘
```

## 🔒 Sécurité

### **Variables d'Environnement**
- Modifiez le fichier `.env` avec vos vraies valeurs
- Ne commitez jamais le fichier `.env`
- Utilisez des secrets forts en production

### **Utilisateur Non-Root**
- L'application s'exécute avec un utilisateur non-root
- Permissions limitées pour la sécurité

## 🚀 Production

### **Déploiement**
```bash
# Build pour la production
docker-compose -f docker-compose.prod.yml build

# Démarrage en production
docker-compose -f docker-compose.prod.yml up -d
```

### **Variables d'Environnement Production**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://user:pass@host:6379
JWT_SECRET=your-super-secret-key
# ... autres variables
```

## 🐛 Dépannage

### **Problèmes Courants**

#### **Port déjà utilisé**
```bash
# Vérifier les ports utilisés
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Arrêter les services
docker-compose down
```

#### **Base de données non accessible**
```bash
# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Redémarrer PostgreSQL
docker-compose restart postgres
```

#### **Application ne démarre pas**
```bash
# Vérifier les logs de l'application
docker-compose logs app

# Rebuild l'image
docker-compose build app
```

#### **Erreurs Prisma**
```bash
# Régénérer le client Prisma
docker-compose exec app npx prisma generate

# Réinitialiser la base de données
docker-compose exec app npx prisma migrate reset
```

### **Nettoyage Complet**
```bash
# Arrêter et supprimer tous les conteneurs
docker-compose down -v --remove-orphans

# Supprimer les images
docker rmi feedplug_app

# Nettoyer le système Docker
docker system prune -f
```

## 📊 Monitoring

### **Health Check**
```bash
# Vérifier la santé de l'application
curl http://localhost:3000/health

# Vérifier la santé des services
docker-compose ps
```

### **Logs**
```bash
# Logs en temps réel
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis
```

## 🔄 Mise à Jour

### **Mise à jour du code**
```bash
# Pull les dernières modifications
git pull

# Rebuild et redémarrer
docker-compose up --build -d
```

### **Mise à jour des dépendances**
```bash
# Mise à jour dans le conteneur
docker-compose exec app npm update

# Rebuild l'image
docker-compose build app
```

## 📚 Ressources

- [Documentation Docker](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Prisma avec Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
- [NestJS avec Docker](https://docs.nestjs.com/recipes/docker)

---

**🎉 Votre environnement FeedPlug est prêt !**
