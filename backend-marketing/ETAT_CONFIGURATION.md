# Configuration de la base de données - ÉTAT ACTUEL

## ✅ Ce qui a été fait :

1. **Base de données créée** : `feedplug_marketing` sur l'instance `feedplug-db`
2. **Autorisation Cloud SQL** : Service account Cloud Run autorisé à se connecter
3. **Migration SQL prête** : `/tmp/migration_complete.sql`

## ⚠️ Ce qui reste à faire :

### 1. Appliquer la migration SQL

Tu as besoin du mot de passe de l'utilisateur `feedplug_user`. Ensuite :

**Option A : Via Cloud SQL Proxy (recommandé)**
```bash
# Télécharger Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Terminal 1 : Démarrer le proxy
./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db

# Terminal 2 : Appliquer la migration
psql -h localhost -U feedplug_user -d feedplug_marketing -f /tmp/migration_complete.sql
```

**Option B : Via gcloud sql connect**
```bash
gcloud sql connect feedplug-db --user=feedplug_user --database=feedplug_marketing --project=feedplug-prod
# Puis copier-coller le contenu de backend-marketing/prisma/migrations/001_create_marketing_leads.sql
```

### 2. Configurer DATABASE_URL dans Cloud Run

Une fois la migration appliquée, configure la variable d'environnement :

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --set-env-vars "DATABASE_URL=postgresql://feedplug_user:[MOT_DE_PASSE]@/feedplug_marketing?host=/cloudsql/feedplug-prod:europe-west1:feedplug-db" \
  --add-cloudsql-instances=feedplug-prod:europe-west1:feedplug-db \
  --project=feedplug-prod
```

**Important** : Remplace `[MOT_DE_PASSE]` par le mot de passe réel de `feedplug_user`.

### 3. Vérifier que ça fonctionne

Les logs du backend devraient afficher :
```
✅ Prisma connected successfully
✅ MarketingLead table accessible
```

## 📝 Note

Le backend fonctionne actuellement en mode "fallback mémoire" jusqu'à ce que DATABASE_URL soit configuré. Une fois configuré, tous les nouveaux leads seront automatiquement sauvegardés en base de données.

**As-tu le mot de passe de `feedplug_user` ?** Si oui, je peux t'aider à finaliser la configuration. Sinon, tu peux :
- Le réinitialiser : `gcloud sql users set-password feedplug_user --instance=feedplug-db --password=[NOUVEAU_MOT_DE_PASSE]`
- Ou créer un nouvel utilisateur dédié pour le marketing



