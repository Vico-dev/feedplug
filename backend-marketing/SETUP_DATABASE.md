# Instructions pour configurer la base de données

## 1. Créer la base de données PostgreSQL

Si vous utilisez Cloud SQL :
```bash
gcloud sql instances create feedplug-marketing-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --project=feedplug-prod
```

## 2. Créer la base de données
```bash
gcloud sql databases create feedplug_marketing \
  --instance=feedplug-marketing-db \
  --project=feedplug-prod
```

## 3. Créer un utilisateur
```bash
gcloud sql users create feedplug_user \
  --instance=feedplug-marketing-db \
  --password=VOTRE_MOT_DE_PASSE \
  --project=feedplug-prod
```

## 4. Obtenir l'IP publique de l'instance
```bash
gcloud sql instances describe feedplug-marketing-db \
  --project=feedplug-prod \
  --format="value(ipAddresses[0].ipAddress)"
```

## 5. Construire la DATABASE_URL
```
postgresql://feedplug_user:VOTRE_MOT_DE_PASSE@IP_PUBLIQUE:5432/feedplug_marketing?sslmode=require
```

## 6. Appliquer la migration SQL

**Option A : Via Cloud SQL Proxy (recommandé)**
```bash
# Installer Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Démarrer le proxy
./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-marketing-db

# Dans un autre terminal, appliquer la migration
psql -h localhost -U feedplug_user -d feedplug_marketing -f backend-marketing/prisma/migrations/001_create_marketing_leads.sql
```

**Option B : Via gcloud**
```bash
gcloud sql connect feedplug-marketing-db --user=feedplug_user --database=feedplug_marketing --project=feedplug-prod
# Puis copier-coller le contenu de 001_create_marketing_leads.sql
```

## 7. Configurer la variable d'environnement dans Cloud Run

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --set-env-vars "DATABASE_URL=postgresql://feedplug_user:PASSWORD@IP:5432/feedplug_marketing?sslmode=require" \
  --project=feedplug-prod
```

## 8. Alternative : Utiliser Prisma Migrate

```bash
cd backend-marketing
export DATABASE_URL="postgresql://feedplug_user:PASSWORD@IP:5432/feedplug_marketing?sslmode=require"
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

## Vérification

Une fois configuré, les logs du backend devraient afficher :
```
✅ Prisma connected successfully
✅ MarketingLead table accessible
```



