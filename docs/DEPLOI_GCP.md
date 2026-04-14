# Déployer FeedPlug sur GCP

Ce guide décrit le déploiement de **FeedPlug** sur **Google Cloud Platform** (Cloud Run).

---

## Prérequis

1. **Google Cloud SDK (gcloud)** installé et connecté :
   ```bash
   gcloud auth login
   gcloud config set project feedplug-prod
   ```

2. **Secrets configurés** dans Secret Manager (projet `feedplug-prod`) :
   - `jwt-secret`
   - `database-url-marketing` (URL PostgreSQL Cloud SQL)
   - `feedplug-gemini-api-key`
   - `stripe-secret-key`, `stripe-webhook-secret`
   - `GOOGLE_CLIENT_ID`, `google-client-secret`
   - `FAL_KEY` (optionnel, si pas Vertex pour les images)

3. **Base de données** : instance Cloud SQL `feedplug-db` en région `europe-west1`, migrations appliquées (voir `backend-marketing/DEPLOI_GCP.md`).

---

## Déploiement complet (backend + frontend)

Depuis la **racine du projet** :

```bash
cd /Users/victorsoldet/Desktop/Feedplug   # ou le chemin de ton repo

chmod +x deploy-score-history-and-app.sh
./deploy-score-history-and-app.sh
```

Ce script :
1. (Optionnel) Applique la migration 021 si `MIGRATE=1` et `PGPASSWORD` sont définis.
2. Déploie le **backend** via Cloud Build → Cloud Run (`feedplug-backend-marketing`).
3. Déploie le **frontend** via `gcloud run deploy` depuis le dossier `frontend` (`feedplug-frontend`).

---

## Déploiement backend uniquement

```bash
cd /Users/victorsoldet/Desktop/Feedplug

gcloud config set project feedplug-prod
gcloud builds submit --config=cloudbuild-backend-marketing.yaml .
```

- Région : **europe-west1**
- Service Cloud Run : **feedplug-backend-marketing**
- URL type : `https://feedplug-backend-marketing-771607738477.europe-west1.run.app`

---

## Déploiement frontend uniquement

```bash
cd /Users/victorsoldet/Desktop/Feedplug/frontend

./deploy-frontend.sh
```

Ou à la main :

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
  --set-env-vars "NEXT_PUBLIC_API_URL=https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1,NEXT_PUBLIC_GOOGLE_CLIENT_ID=771607738477-iam4qts7ch3sn9do88djdkohvpj0f4a9.apps.googleusercontent.com" \
  --project feedplug-prod \
  --clear-base-image
```

---

## Résumé des services GCP

| Composant | Service Cloud Run | Région | URL (exemple) |
|-----------|-------------------|--------|----------------|
| Backend (API) | feedplug-backend-marketing | europe-west1 | `https://feedplug-backend-marketing-771607738477.europe-west1.run.app` |
| Frontend (Next.js) | feedplug-frontend | europe-west1 | `https://feedplug-frontend-771607738477.europe-west1.run.app` |

En production, le frontend est généralement servi sous un domaine personnalisé (ex. `https://app.feedplug.com`) via un load balancer ou un mapping de domaine Cloud Run.

---

## Vérifications après déploiement

- **Backend** : `curl https://feedplug-backend-marketing-771607738477.europe-west1.run.app/health` (ou la route health de ton API).
- **Frontend** : ouvrir l’URL du service ou `https://app.feedplug.com` si le domaine est configuré.
- **Variables d’environnement** : dans la console GCP → Cloud Run → service → modifier la révision → Variables et secrets.

Pour plus de détails (migrations, secrets, OAuth, GMC), voir :
- `backend-marketing/DEPLOI_GCP.md`
- `docs/GUIDE_PROD_APP_URL_MIGRATIONS_GMC.md`
