# Déployer le backend FeedPlug sur GCP

Ce guide décrit comment déployer **backend-marketing** (API + export GMC/Amazon) sur **Google Cloud Platform** : migration base, puis déploiement Cloud Run.

---

## Prérequis

- **gcloud** installé et connecté : `gcloud auth login`
- Projet GCP utilisé : **feedplug-prod** (ou le vôtre)
- **Secret Manager** : les secrets suivants doivent exister :
  - `jwt-secret`
  - `secret-encryption-key`
  - `database-url-marketing` (URL PostgreSQL Cloud SQL)
  - `feedplug-gemini-api-key`

---

## Étape 1 : Appliquer les migrations SQL

À faire **avant** ou **juste après** le déploiement du nouveau code.

- **013_export_channel.sql** : sans elle, les routes Amazon canaux renverront une erreur 500.
- **021_product_score_history.sql** : historique du score produit (graphique d’évolution sur la fiche produit). Sans elle, l’app enregistre le score mais pas l’historique (pas de crash).
- **030_oauth_ephemeral_state.sql** : indispensable pour les callbacks OAuth Shopify/Amazon en environnement multi-instance (Cloud Run).
- **031_shared_rate_limits.sql** : indispensable pour les protections anti-abus partagées entre instances Cloud Run.

Le backend n’applique plus aucune migration au runtime: les schémas requis doivent être présents avant démarrage.

### Où trouver les infos de connexion

| Info | Valeur dans votre projet | Où la trouver |
|------|--------------------------|----------------|
| **Utilisateur** | `feedplug_user` | Fixe (défini dans les scripts du repo). |
| **Base de données** | `feedplug_marketing` | Fixe (nom de la DB sur Cloud SQL). |
| **Host (avec proxy)** | `127.0.0.1` | Quand Cloud SQL Proxy tourne en local, PostgreSQL est exposé sur le port 5432 en localhost. |
| **Port** | `5432` | Port par défaut PostgreSQL. |
| **Mot de passe** | *(secret)* | Voir ci‑dessous. |

**Récupérer le mot de passe :**

- **Option 1 — Secret Manager (si vous avez accès)**  
  Le mot de passe est dans le secret **`database-url-marketing`** (c’est l’URL complète utilisée par Cloud Run). Pour afficher la valeur du secret (et en extraire le mot de passe) :
  ```bash
  gcloud secrets versions access latest --secret=database-url-marketing --project=feedplug-prod
  ```
  Vous obtiendrez une URL du type :  
  `postgresql://feedplug_user:LE_MOT_DE_PASSE_ICI@.../feedplug_marketing?...`  
  Le mot de passe est entre `feedplug_user:` et le `@` suivant.

- **Option 2 — Réinitialiser le mot de passe**  
  Si vous ne retrouvez pas l’ancien mot de passe, définissez-en un nouveau pour `feedplug_user` :
  ```bash
  gcloud sql users set-password feedplug_user \
    --instance=feedplug-db \
    --password=VOTRE_NOUVEAU_MOT_DE_PASSE \
    --project=feedplug-prod
  ```
  Pensez à mettre à jour le secret **`database-url-marketing`** dans Secret Manager avec la nouvelle URL (même format qu’avant, avec le nouveau mot de passe), pour que Cloud Run continue de se connecter.

### Option A : Cloud SQL Proxy (recommandé)

1. **Télécharger Cloud SQL Proxy** (une fois) :
   ```bash
   # macOS ARM (M1/M2)
   curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
   chmod +x cloud-sql-proxy

   # macOS Intel
   # curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
   ```

2. **Démarrer le proxy** (dans un terminal, laisser tourner) :
   ```bash
   ./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db
   ```
   *(Remplacez `feedplug-db` par le nom de votre instance Cloud SQL si différent.)*

3. **Dans un autre terminal**, appliquer les migrations nécessaires :
   ```bash
   cd /chemin/vers/Feedplug

   psql "postgresql://feedplug_user:VOTRE_MOT_DE_PASSE@127.0.0.1:5432/feedplug_marketing?sslmode=disable" \
     -f backend-marketing/prisma/migrations/013_export_channel.sql

   psql "postgresql://feedplug_user:VOTRE_MOT_DE_PASSE@127.0.0.1:5432/feedplug_marketing?sslmode=disable" \
     -f backend-marketing/prisma/migrations/030_oauth_ephemeral_state.sql

   psql "postgresql://feedplug_user:VOTRE_MOT_DE_PASSE@127.0.0.1:5432/feedplug_marketing?sslmode=disable" \
     -f backend-marketing/prisma/migrations/031_shared_rate_limits.sql
   ```
   Remplacez `VOTRE_MOT_DE_PASSE` par le mot de passe (voir « Où trouver les infos de connexion » ci‑dessus).

### Option B : Connexion directe gcloud

```bash
gcloud sql connect feedplug-db \
  --user=feedplug_user \
  --database=feedplug_marketing \
  --project=feedplug-prod
```

Dans la session `psql` qui s’ouvre, collez le contenu du fichier **`backend-marketing/prisma/migrations/013_export_channel.sql`**, puis celui de **`backend-marketing/prisma/migrations/030_oauth_ephemeral_state.sql`**, puis celui de **`backend-marketing/prisma/migrations/031_shared_rate_limits.sql`**, puis `\q` pour quitter.

---

## Étape 2 : Déployer sur Cloud Run

Le déploiement se fait via **Cloud Build** : build de l’image Docker du backend-marketing puis déploiement du service Cloud Run.

### 2.1 Depuis la racine du dépôt (recommandé)

À la **racine du projet Feedplug** (là où se trouve `cloudbuild-backend-marketing.yaml`) :

```bash
cd /Users/victorsoldet/Desktop/Feedplug

# Définir le projet
gcloud config set project feedplug-prod

# Lancer le build et le déploiement (utilise le dernier commit pour le tag d’image)
gcloud builds submit \
  --config=cloudbuild-backend-marketing.yaml \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "latest") \
  .
```

Cloud Build va :
1. Construire l’image Docker avec `backend-marketing/Dockerfile`
2. Pousser l’image vers **Container Registry** : `gcr.io/feedplug-prod/feedplug-backend-marketing:COMMIT_SHA`
3. Déployer le service **feedplug-backend-marketing** sur **Cloud Run** (région **europe-west1**)

Les variables et secrets déjà configurés dans le fichier (`NODE_ENV`, `CORS_ORIGIN`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`) seront appliqués au service.

### 2.2 Si vous utilisez un trigger Cloud Build (Git)

Si un trigger est configuré pour exécuter `cloudbuild-backend-marketing.yaml` sur chaque push (ex. sur `main`) :

1. Poussez vos changements sur la branche concernée.
2. Le build se lancera automatiquement ; vérifiez l’onglet **Cloud Build > History** dans la console GCP.

---

## Étape 3 : Vérifications après déploiement

1. **URL du service** (à retrouver dans la console Cloud Run ou en CLI) :
   ```bash
   gcloud run services describe feedplug-backend-marketing \
     --region=europe-west1 \
     --format='value(status.url)' \
     --project=feedplug-prod
   ```
   Exemple : `https://feedplug-backend-marketing-XXXXX.europe-west1.run.app`

2. **Test rapide** :
   - Santé / ping : `GET https://VOTRE_URL/health` (si vous avez une route dédiée)
   - Export GMC : `GET https://VOTRE_URL/api/v1/ingestion/feeds/:feedId/export?format=csv&platform=gmc`
   - Canaux Amazon disponibles (sans auth) : `GET https://VOTRE_URL/api/v1/platforms/amazon/channels/available`

---

## Clé API Gemini (optimisation titres / descriptions IA)

L’**optimisation des titres** et **descriptions** par IA (modal « Optimisation des titres », enrichissement catalogue) utilise **Google Gemini**. Sans clé configurée, tu obtiens « Aucun titre optimisé généré ».

### Où la clé est utilisée

- **Fichier** : `backend-marketing/ai/ai-wrapper.js`
- **Variable d’environnement** : `GEMINI_API_KEY`
- **Source** : d’abord la table `AIProviderKey` (clés en base), sinon `process.env.GEMINI_API_KEY`

### En production (Cloud Run)

Le **Cloud Build** injecte la clé via **Secret Manager** :

- **Nom du secret** : `feedplug-gemini-api-key`
- **Mapping** : le secret est exposé en variable d’environnement `GEMINI_API_KEY` pour le service Cloud Run.

**À faire :**

1. **Créer ou mettre à jour le secret** (remplace `TA_CLE_GEMINI` par ta clé API Google AI Studio) :
   ```bash
   echo -n "TA_CLE_GEMINI" | gcloud secrets create feedplug-gemini-api-key \
     --data-file=- \
     --project=feedplug-prod
   ```
   Si le secret existe déjà et que tu veux changer la valeur :
   ```bash
   echo -n "TA_CLE_GEMINI" | gcloud secrets versions add feedplug-gemini-api-key \
     --data-file=- \
     --project=feedplug-prod
   ```

2. **Droits du compte de service Cloud Run**  
   Le compte de service utilisé par Cloud Run doit avoir le droit **Secret Manager - Accès aux versions de secret** sur le secret `feedplug-gemini-api-key`. En général c’est déjà le cas si les autres secrets (JWT_SECRET, DATABASE_URL) fonctionnent. Sinon, dans la console : **Secret Manager** → `feedplug-gemini-api-key` → **Autorisations** → ajouter le compte de service du service Cloud Run avec le rôle **Accès aux versions de secret**.

3. **Pas besoin de redéployer** si tu as seulement ajouté/mis à jour le secret (référence `:latest`). Un **nouveau déploiement** ou un redémarrage de révision peut être nécessaire pour que la nouvelle version du secret soit lue.

### En local

Dans `backend-marketing/.env` (ou à la racine) :

```env
GEMINI_API_KEY=ta_cle_api_gemini_ici
```

Tu peux créer une clé (gratuite) ici : [Google AI Studio](https://aistudio.google.com/apikey).

---

## Variables optionnelles (OAuth GMC, etc.)

Le fichier **cloudbuild-backend-marketing.yaml** ne définit que :

- `NODE_ENV=production`
- `CORS_ORIGIN=https://app.feedplug.com`
- Secrets : `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`

Pour que la **connexion Google Merchant Center (GMC)** fonctionne, le service doit aussi avoir :

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (ex. `https://feedplug-backend-marketing-XXXXX.europe-west1.run.app/api/v1/platforms/gmc/callback`)

Si ce n’est pas déjà fait, ajoutez-les une fois (par exemple via la console Cloud Run **Variables et secrets**, ou en CLI) :

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --set-env-vars="GOOGLE_REDIRECT_URI=https://VOTRE_URL_CLOUD_RUN/api/v1/platforms/gmc/callback"
```

Et stockez **GOOGLE_CLIENT_ID** et **GOOGLE_CLIENT_SECRET** dans Secret Manager puis attachez-les au service (comme pour `JWT_SECRET`), ou en variables si vous préférez.

---

## Récap ordre des opérations

| Ordre | Action |
|-------|--------|
| 1 | Appliquer les migrations SQL si besoin (013, **021_product_score_history**, **030_oauth_ephemeral_state**, **031_shared_rate_limits**) — Cloud SQL Proxy ou `./backend-marketing/scripts/run-migrations-one-shot.sh` |
| 2 | Lancer le déploiement : `./deploy-backend-marketing.sh` ou `gcloud builds submit --config=cloudbuild-backend-marketing.yaml .` |
| 3 | Déployer le frontend : `./deploy-frontend.sh` |
| 4 | Vérifier l’URL Cloud Run et tester l’API / export |

**Tout-en-un** : `./deploy-score-history-and-app.sh` (backend + frontend). Pour appliquer aussi la migration 021 : `MIGRATE=1 ./deploy-score-history-and-app.sh` (avec `PGPASSWORD` défini ou Secret Manager accessible).

Une fois les migrations appliquées et le build terminé, le backend est déployé sur GCP et prêt à l’usage.
