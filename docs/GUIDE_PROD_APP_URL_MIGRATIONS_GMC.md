# Guide pas à pas : APP_URL, migrations 022/023, OAuth GMC

Ce guide détaille les trois actions à faire en production pour la connexion Merchant Center et les tests A/B.

---

## Partie 1 : Variables d’environnement sur le backend (Cloud Run)

Le backend est le service **feedplug-backend-marketing** sur Cloud Run (projet **feedplug-prod**, région **europe-west1**).

### Étape 1.1 — Vérifier ou définir APP_URL

**APP_URL** est l’URL de votre frontend. Après la connexion Google (GMC), l’utilisateur est redirigé vers `APP_URL/flux`.

- **Déjà dans le Cloud Build** : dans `cloudbuild-backend-marketing.yaml`, la variable `APP_URL=https://app.feedplug.com` est déjà définie. Si votre front est bien sur `https://app.feedplug.com`, vous n’avez rien à faire.
- **Pour vérifier ou modifier** (sans redéployer le code) :
  1. Ouvrez [Google Cloud Console](https://console.cloud.google.com/) → projet **feedplug-prod**.
  2. Menu **Cloud Run** (recherchez « Cloud Run »).
  3. Cliquez sur le service **feedplug-backend-marketing**.
  4. Onglet **Modifier et déployer une nouvelle révision** (ou **Edit & deploy new revision**).
  5. Section **Variables et secrets** → **Variables d’environnement**.
  6. Cherchez **APP_URL**. Si elle est à `https://app.feedplug.com` (ou votre URL de front), c’est bon. Sinon, ajoutez ou modifiez : `APP_URL` = `https://app.feedplug.com` (sans slash final).
  7. Cliquez sur **Déployer** en bas de page.

### Étape 1.2 — Définir GOOGLE_REDIRECT_URI

**GOOGLE_REDIRECT_URI** doit être **exactement** l’URL de callback OAuth de votre backend. Google redirige vers cette URL après que l’utilisateur autorise l’app.

1. **Récupérer l’URL du service Cloud Run** (dans un terminal) :
   ```bash
   gcloud run services describe feedplug-backend-marketing \
     --region=europe-west1 \
     --project=feedplug-prod \
     --format='value(status.url)'
   ```
   Exemple de sortie : `https://feedplug-backend-marketing-771607738477.europe-west1.run.app`

2. **Construire l’URI de redirection** :  
   `VOTRE_URL_CI_DESSUS/api/v1/platforms/gmc/callback`  
   Exemple : `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/gmc/callback`

3. **Ajouter la variable au service** (remplacez `VOTRE_URL` par la valeur de l’étape 1) :
   ```bash
   gcloud run services update feedplug-backend-marketing \
     --region=europe-west1 \
     --project=feedplug-prod \
     --set-env-vars="GOOGLE_REDIRECT_URI=https://VOTRE_URL/api/v1/platforms/gmc/callback"
   ```
   Exemple concret (à adapter si votre URL est différente) :
   ```bash
   gcloud run services update feedplug-backend-marketing \
     --region=europe-west1 \
     --project=feedplug-prod \
     --set-env-vars="GOOGLE_REDIRECT_URI=https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/gmc/callback"
   ```

4. **Optionnel — figer dans le Cloud Build** : pour que chaque futur déploiement ait cette variable, vous pouvez l’ajouter dans `cloudbuild-backend-marketing.yaml`, dans la chaîne `--set-env-vars`, en ajoutant par exemple :  
   `,GOOGLE_REDIRECT_URI=https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/gmc/callback`  
   (en remplaçant par votre URL réelle si différente).

---

## Partie 2 : Exécuter les migrations 022 et 023 en base

Les migrations à appliquer :
- **022** : lien test A/B ↔ règle (`ruleid` sur `ab_test`).
- **023** : contrainte unique `(accountid, platform)` sur `PlatformConnection` (pour l’upsert GMC).

Vous avez besoin de **DATABASE_URL** (ou host/user/password + base) pour vous connecter à la base **feedplug_marketing** sur Cloud SQL.

### Option A — Avec DATABASE_URL (Secret Manager) et psql en local

1. **Récupérer l’URL de la base** (Secret Manager) :
   ```bash
   gcloud secrets versions access latest --secret=database-url-marketing --project=feedplug-prod
   ```
   Copiez la sortie (elle ressemble à `postgresql://feedplug_user:XXX@/feedplug_marketing?host=...`).  
   **Attention** : avec une URL Cloud SQL en socket (`?host=/cloudsql/...`), `psql` ne peut pas l’utiliser directement. Passez à l’option B (Cloud SQL Proxy).

2. **Si votre URL contient un host réseau** (ex. IP ou nom d’instance Cloud SQL accessible) :
   ```bash
   cd /Users/victorsoldet/Desktop/Feedplug
   export DATABASE_URL="COLLEZ_ICI_L_URL_COMPLETE"
   psql "$DATABASE_URL" -f backend-marketing/prisma/migrations/022_ab_test_rule_id.sql
   psql "$DATABASE_URL" -f backend-marketing/prisma/migrations/023_platform_connection_unique.sql
   ```

### Option B — Avec Cloud SQL Proxy (recommandé si vous utilisez déjà le proxy)

1. **Démarrer Cloud SQL Proxy** dans un premier terminal :
   ```bash
   cloud_sql_proxy -instances=feedplug-prod:europe-west1:feedplug-db=tcp:5432
   ```
   (Ou avec le script du repo s’il existe, ex. `./cloud-sql-proxy feedplug-prod:europe-west1:feedplug-db`.)

2. **Récupérer le mot de passe** (si vous ne l’avez pas) :
   ```bash
   gcloud secrets versions access latest --secret=database-url-marketing --project=feedplug-prod
   ```
   Dans l’URL, le mot de passe est entre `feedplug_user:` et le `@` suivant.

3. **Dans un second terminal**, exécuter les migrations (remplacez `MOT_DE_PASSE` par le mot de passe) :
   ```bash
   cd /Users/victorsoldet/Desktop/Feedplug
   export PGPASSWORD="MOT_DE_PASSE"
   psql -h 127.0.0.1 -p 5432 -U feedplug_user -d feedplug_marketing -f backend-marketing/prisma/migrations/022_ab_test_rule_id.sql
   psql -h 127.0.0.1 -p 5432 -U feedplug_user -d feedplug_marketing -f backend-marketing/prisma/migrations/023_platform_connection_unique.sql
   ```

4. **Vérification** (optionnel) :
   ```bash
   psql -h 127.0.0.1 -p 5432 -U feedplug_user -d feedplug_marketing -c "\d \"PlatformConnection\""
   ```
   Vous devez voir un index unique sur `(accountid, platform)`.

### Si une migration a déjà été appliquée

- **022** : si la colonne `ruleid` existe déjà sur `ab_test`, la migration peut afficher une notice ou ne rien faire (selon les `IF NOT EXISTS`). Pas de panique.
- **023** : si l’index unique existe déjà, `IF NOT EXISTS` évite l’erreur. Sinon, la création peut échouer s’il y a des doublons `(accountid, platform)` ; dans ce cas, supprimez les doublons avant de réexécuter.

---

## Partie 3 : Vérifier l’URI de redirection OAuth dans Google Cloud Console

Pour que la connexion GMC fonctionne, l’**URI de redirection** configurée dans le client OAuth 2.0 Google doit être **exactement** celle utilisée par le backend (`GOOGLE_REDIRECT_URI`).

1. Ouvrez [Google Cloud Console](https://console.cloud.google.com/) → projet utilisé pour OAuth (souvent le même que Cloud Run, ex. **feedplug-prod**).

2. Menu **APIs et services** → **Identifiants** (Credentials).

3. Dans **Identifiants OAuth 2.0**, cliquez sur le client que vous utilisez pour FeedPlug (type **Application Web**).  
   Si vous n’en avez pas, créez-en un : **Créer des identifiants** → **ID client OAuth** → Type **Application Web**.

4. Section **URI de redirection autorisés** :
   - Vous devez avoir **exactement** une ligne égale à votre `GOOGLE_REDIRECT_URI`, par exemple :  
     `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/gmc/callback`
   - Pas de slash final, pas d’espace, même schéma (https) et même host/chemin.

5. Si ce n’est pas le cas :
   - Cliquez sur **Ajouter un URI**.
   - Saisissez l’URL complète (celle que vous avez mise dans `GOOGLE_REDIRECT_URI` à la partie 1).
   - Enregistrez.

6. **Origines JavaScript autorisées** (si votre front appelle l’API depuis le navigateur) : ajoutez l’origine de votre front, ex. `https://app.feedplug.com`.

---

## Secret Manager : GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET

Le backend lit `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` pour la connexion GMC. En prod ils viennent de **Secret Manager** (injectés par le Cloud Build).

- **Noms des secrets attendus** dans Secret Manager (projet feedplug-prod) :
  - `google-client-id` → variable `GOOGLE_CLIENT_ID`
  - `google-client-secret` → variable `GOOGLE_CLIENT_SECRET`
- Si tes secrets ont d’autres noms (ex. `GOOGLE_CLIENT_ID`, `google_client_secret`), adapte la ligne `--update-secrets` dans `cloudbuild-backend-marketing.yaml` pour utiliser ces noms (ex. `GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest`).
- Après création ou modification des secrets, **redéploie le backend** pour que Cloud Run charge les valeurs.

---

## Récapitulatif

| Action | Où | Commande / écran |
|--------|-----|-------------------|
| APP_URL | Cloud Run ou déjà dans cloudbuild | Console Cloud Run → feedplug-backend-marketing → Variables → APP_URL |
| GOOGLE_REDIRECT_URI | Cloud Run | `gcloud run services update feedplug-backend-marketing ... --set-env-vars="GOOGLE_REDIRECT_URI=..."` |
| Migration 022 | Base feedplug_marketing | `psql $DATABASE_URL -f .../022_ab_test_rule_id.sql` (ou via proxy) |
| Migration 023 | Base feedplug_marketing | `psql $DATABASE_URL -f .../023_platform_connection_unique.sql` (ou via proxy) |
| URI OAuth | Google Cloud Console | APIs et services → Identifiants → client OAuth → URI de redirection autorisés |

Une fois ces trois parties faites, refaites un test de connexion GMC depuis l’app (bouton « Connecter Google » sur la page Flux). En cas d’erreur, consultez `docs/NEXT_STEPS_ET_GMC.md` (symptômes et correctifs).
