# Guide rapide pour finaliser la configuration de la base de données

## Étape 1 : Appliquer la migration SQL

Tu as deux options :

### Option A : Via Cloud SQL Proxy (recommandé)

```bash
# Télécharger Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Démarrer le proxy dans un terminal
./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db

# Dans un autre terminal, appliquer la migration
psql -h localhost -U feedplug_user -d feedplug_marketing -f backend-marketing/prisma/migrations/001_create_marketing_leads.sql
```

### Option B : Via Prisma Migrate (une fois DATABASE_URL configuré)

```bash
cd backend-marketing
export DATABASE_URL="postgresql://feedplug_user:[TON_MOT_DE_PASSE]@35.205.219.146:5432/feedplug_marketing?sslmode=require"
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

## Étape 2 : Configurer DATABASE_URL dans Cloud Run

Remplace `[TON_MOT_DE_PASSE]` par le mot de passe de l'utilisateur `feedplug_user` :

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --set-env-vars "DATABASE_URL=postgresql://feedplug_user:[TON_MOT_DE_PASSE]@35.205.219.146:5432/feedplug_marketing?sslmode=require" \
  --project=feedplug-prod
```

## Étape 3 : Autoriser Cloud Run à se connecter à Cloud SQL

```bash
# Obtenir le service account de Cloud Run
SERVICE_ACCOUNT=$(gcloud run services describe feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --format="value(spec.template.spec.serviceAccountName)")

# Ajouter l'autorisation
gcloud sql instances patch feedplug-db \
  --project=feedplug-prod \
  --add-iam-binding \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

## Étape 4 : Utiliser la connexion Unix Socket (recommandé pour Cloud Run)

Une fois autorisé, modifie la DATABASE_URL pour utiliser le socket Unix :

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --set-env-vars "DATABASE_URL=postgresql://feedplug_user:[TON_MOT_DE_PASSE]@/feedplug_marketing?host=/cloudsql/feedplug-prod:europe-west1:feedplug-db" \
  --add-cloudsql-instances=feedplug-prod:europe-west1:feedplug-db \
  --project=feedplug-prod
```

## Vérification

Les logs du backend devraient afficher :
```
✅ Prisma connected successfully
✅ MarketingLead table accessible
```

Si tu veux que je configure tout ça automatiquement, j'ai besoin du mot de passe de `feedplug_user`. Sinon, tu peux suivre ces étapes manuellement.



