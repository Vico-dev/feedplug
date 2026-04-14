# Guide de déploiement - Système de récolte des leads

## 📋 Résumé des modifications

### ✅ Modifications effectuées

1. **Modèle Prisma `MarketingLead`**
   - Ajouté dans `backend/prisma/schema.prisma` et `prisma/schema.prisma`
   - Table `marketing_leads` avec tous les champs nécessaires
   - Index et contraintes d'unicité

2. **Backend (`server-minimal.js`)**
   - Intégration de Prisma Client
   - Endpoint POST `/api/v1/marketing/early-access` : sauvegarde en base de données
   - Endpoint GET `/api/v1/marketing/leads` : consultation avec pagination (admin)
   - Capture du `locale` depuis le frontend

3. **Frontend**
   - Envoi du `locale` dans la requête POST

4. **Dockerfile et scripts**
   - `Dockerfile.minimal` : Dockerfile pour server-minimal.js avec Prisma
   - `deploy-backend-minimal.sh` : Script de déploiement backend
   - `deploy-complete.sh` : Script de déploiement complet (backend + frontend)
   - `apply-migration.sh` : Script pour appliquer la migration
   - `prisma/migrations/add_marketing_leads.sql` : Migration SQL

## 🚀 Étapes de déploiement

### Étape 1: Migration de la base de données

**Option A: Via SQL direct**
```bash
# Si vous avez accès à Cloud SQL Proxy
cloud_sql_proxy -instances=feedplug-prod:europe-west1:feedplug-db=tcp:5432

# Dans un autre terminal
psql -h localhost -U feedplug_user -d feedplug -f prisma/migrations/add_marketing_leads.sql
```

**Option B: Via Prisma Migrate**
```bash
export DATABASE_URL="postgresql://user:password@host:5432/feedplug"
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**Option C: Via le script**
```bash
./apply-migration.sh
```

### Étape 2: Déploiement du backend

```bash
# Option A: Via le script automatique
./deploy-backend-minimal.sh

# Option B: Manuellement
docker build -f Dockerfile.minimal -t gcr.io/feedplug-prod/feedplug-backend-minimal:latest .
docker push gcr.io/feedplug-prod/feedplug-backend-minimal:latest

gcloud run deploy feedplug-backend-minimal \
  --image gcr.io/feedplug-prod/feedplug-backend-minimal:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,PORT=8080,DATABASE_URL=..." \
  --project feedplug-prod
```

**⚠️ IMPORTANT**: Assurez-vous que `DATABASE_URL` est définie dans les variables d'environnement Cloud Run !

### Étape 3: Déploiement du frontend

```bash
cd frontend

gcloud run deploy feedplug-frontend \
  --source . \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_API_URL=https://api.feedplug.com/api/v1" \
  --project feedplug-prod \
  --clear-base-image
```

### Étape 4: Déploiement complet (tout en un)

```bash
./deploy-complete.sh
```

## 🔍 Vérification

### Vérifier que la migration est appliquée
```sql
-- Connectez-vous à votre base de données
SELECT * FROM marketing_leads LIMIT 1;
```

### Tester l'endpoint POST
```bash
curl -X POST https://api.feedplug.com/api/v1/marketing/early-access \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "jobTitle": "CEO",
    "phone": "+33123456789",
    "email": "test@example.com",
    "company": "Test Company",
    "locale": "fr"
  }'
```

### Tester l'endpoint GET (nécessite authentification)
```bash
# D'abord, obtenez un token JWT via /api/v1/auth/login
TOKEN="your-jwt-token"

curl -X GET https://api.feedplug.com/api/v1/marketing/leads \
  -H "Authorization: Bearer $TOKEN"
```

## 📊 Consultation des leads

Une fois déployé, vous pouvez consulter les leads via :
- **API**: `GET /api/v1/marketing/leads` (nécessite authentification admin)
- **Prisma Studio**: `npx prisma studio` (en local)
- **SQL direct**: `SELECT * FROM marketing_leads ORDER BY "createdAt" DESC;`

## 🐛 Dépannage

### Erreur: "Prisma Client not found"
- Vérifiez que `npx prisma generate` a été exécuté
- Vérifiez que `node_modules/.prisma` est présent dans l'image Docker

### Erreur: "Table marketing_leads does not exist"
- La migration n'a pas été appliquée
- Exécutez `apply-migration.sh` ou le SQL manuellement

### Erreur: "Connection refused" ou "Database connection failed"
- Vérifiez que `DATABASE_URL` est correctement définie dans Cloud Run
- Vérifiez que Cloud SQL est accessible depuis Cloud Run

## 📝 Notes importantes

1. **Variables d'environnement**: Assurez-vous que `DATABASE_URL` est définie dans Cloud Run
2. **Sécurité**: L'endpoint GET est protégé par authentification (rôle OWNER requis)
3. **Email**: Les notifications email sont toujours envoyées si `SMTP_*` est configuré
4. **Locale**: Le `locale` est automatiquement capturé depuis le frontend



