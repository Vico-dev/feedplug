# Diagnostic de la connexion à la base de données

## Problème actuel
L'erreur "Prisma non disponible (sources)" indique que le backend ne peut pas se connecter à la base de données PostgreSQL.

## Vérifications à effectuer

### 1. Vérifier les logs du backend

Pour voir les erreurs exactes, consultez les logs Cloud Run :

```bash
gcloud run services logs read feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --limit=50
```

Ou via la console : https://console.cloud.google.com/run/detail/europe-west1/feedplug-backend-marketing/logs

**Recherchez** :
- `✅ Prisma connected successfully` → La connexion fonctionne
- `❌ Database connection test failed` → Problème de connexion
- `⚠️ Prisma initialization error` → Erreur détaillée

### 2. Vérifier que la base de données existe

```bash
gcloud sql databases list \
  --instance=feedplug-db \
  --project=feedplug-prod
```

**Vérifiez** que `feedplug_marketing` est dans la liste.

Si elle n'existe pas, créez-la :
```bash
gcloud sql databases create feedplug_marketing \
  --instance=feedplug-db \
  --project=feedplug-prod
```

### 3. Vérifier que l'utilisateur existe et que le mot de passe est correct

```bash
gcloud sql users list \
  --instance=feedplug-db \
  --project=feedplug-prod
```

**Vérifiez** que `feedplug_user` existe.

Si le mot de passe est incorrect, changez-le :
```bash
gcloud sql users set-password feedplug_user \
  --instance=feedplug-db \
  --password="$DB_PASSWORD" \  # Utiliser un mot de passe fort depuis Secret Manager
  --project=feedplug-prod
```

### 4. Vérifier la connexion Cloud SQL

Le service Cloud Run doit avoir accès à Cloud SQL. Vérifiez que `--add-cloudsql-instances` est bien configuré :

```bash
gcloud run services describe feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --format="value(spec.template.spec.containers[0].env)"
```

**Vérifiez** que `DATABASE_URL` contient :
- Base de données : `feedplug_marketing` (pas `feedplug`)
- Host : `/cloudsql/feedplug-prod:europe-west1:feedplug-db`

### 5. Appliquer les migrations SQL

Si la base de données existe mais que les tables n'existent pas, appliquez les migrations :

**Option A : Via Cloud SQL Proxy (recommandé)**

```bash
# Télécharger Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Terminal 1 : Démarrer le proxy
./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db

# Terminal 2 : Appliquer les migrations
cd backend-marketing/prisma/migrations
psql -h localhost -U feedplug_user -d feedplug_marketing -f 001_create_marketing_leads.sql
psql -h localhost -U feedplug_user -d feedplug_marketing -f 002_ingestion_models.sql
psql -h localhost -U feedplug_user -d feedplug_marketing -f 003_custom_columns.sql
psql -h localhost -U feedplug_user -d feedplug_marketing -f 004_scoring_models.sql
psql -h localhost -U feedplug_user -d feedplug_marketing -f 005_ai_management.sql
```

**Option B : Via gcloud sql connect**

```bash
gcloud sql connect feedplug-db \
  --user=feedplug_user \
  --database=feedplug_marketing \
  --project=feedplug-prod
```

Puis copier-coller le contenu de chaque fichier de migration.

### 6. Vérifier que les tables existent

Une fois les migrations appliquées, vérifiez que les tables existent :

```sql
\dt
```

Vous devriez voir au minimum :
- `marketing_leads`
- `FeedSource`
- `Feed`
- `FeedItem`

## Solutions rapides

### Si la base de données n'existe pas
```bash
gcloud sql databases create feedplug_marketing \
  --instance=feedplug-db \
  --project=feedplug-prod
```

### Si le mot de passe est incorrect
```bash
gcloud sql users set-password feedplug_user \
  --instance=feedplug-db \
  --password="$DB_PASSWORD" \  # Utiliser un mot de passe fort depuis Secret Manager
  --project=feedplug-prod
```

Puis redéployez le backend :
```bash
./deploy-backend-marketing.sh
```

### Si les tables n'existent pas
Appliquez les migrations (voir étape 5 ci-dessus).

## Après correction

Une fois les corrections appliquées, attendez 1-2 minutes puis testez à nouveau la création d'une source. Les logs du backend devraient afficher :

```
✅ Prisma connected successfully
✅ Database connection test successful
✅ MarketingLead table accessible
✅ Migration ingestion appliquée (ou déjà en place)
```

