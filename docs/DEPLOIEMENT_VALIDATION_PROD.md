# Déploiement et validation en production

**Objectif** : S’assurer qu’une nouvelle feature déployée en prod fonctionne vraiment, et savoir diagnostiquer quand ce n’est pas le cas.

---

## 1. Ce que les logs ont montré (exemple Performance / CORS)

Commande pour consulter les logs Cloud Run (backend) :

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="feedplug-backend-marketing"' \
  --limit=50 \
  --format="table(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)" \
  --project=feedplug-prod
```

**Constats :**

- Les requêtes **OPTIONS** (preflight CORS) arrivent bien au backend avec la méthode **OPTIONS** (pas convertie en GET).
- Elles reçoivent toutes une réponse **429** (trop de requêtes).
- **Conclusion** : le rate limiter répond avant le handler qui doit renvoyer 204 pour OPTIONS. Soit la révision déployée n’a pas encore le middleware OPTIONS en tout premier, soit l’ordre des middlewares n’est pas le bon sur cette révision.

**À faire côté code** (déjà en place) : handler OPTIONS en tout premier dans `server-minimal.js` + `skip: (req) => req.method === 'OPTIONS'` dans le rate limiter. Après un déploiement avec build **sans cache** (`--no-cache` dans Cloud Build), vérifier à nouveau les logs : les OPTIONS doivent passer en **204**.

---

## 2. Checklist avant de pousser une feature en prod

### 2.1 Backend (backend-marketing)

| Étape | Action |
|-------|--------|
| 1 | Vérifier que tout nouveau module (ex. `performance/`) est **copié dans le Dockerfile** (`COPY ... ./.../`) |
| 2 | Si la feature expose des routes API : CORS à jour (origines autorisées dans `server-minimal.js`) |
| 3 | Routes protégées : `requireAuth` ou équivalent sur les routes sensibles |
| 4 | Tester en local au moins : `node server-minimal.js` (ou script de dev) + un appel curl/Postman sur la nouvelle route |
| 5 | Vérifier qu’aucun `console.log` sensible ou secret n’est laissé |

### 2.2 Frontend

| Étape | Action |
|-------|--------|
| 1 | Appels API via **`API_BASE_URL`** (depuis `@/lib/api`) — pas d’URL backend en dur ailleurs |
| 2 | Nouvelles routes “app” (dashboard, etc.) : **`APP_ROUTES`** dans `middleware.ts` pour la redirection feedplug.com → app.feedplug.com |
| 3 | Gestion d’erreur (401, réseau, “Failed to fetch”) sur les pages qui appellent l’API |
| 4 | Build local OK : `cd frontend && npm run build` (sans erreur) |

### 2.3 Déploiement

| Étape | Action |
|-------|--------|
| 1 | Variables d’env de prod à jour (Cloud Build / `deploy-*.sh`) : `NEXT_PUBLIC_API_URL`, secrets, etc. |
| 2 | Pour un correctif critique : build Docker **sans cache** (déjà prévu dans `cloudbuild-backend-marketing.yaml` avec `--no-cache` si besoin) |

---

## 3. Vérification après déploiement

### 3.1 Vérifier que la bonne révision sert le trafic

```bash
gcloud run revisions list --service=feedplug-backend-marketing --region=europe-west1 --project=feedplug-prod --limit=3
gcloud run services describe feedplug-backend-marketing --region=europe-west1 --project=feedplug-prod --format="yaml(status.traffic)"
```

S’assurer que la révision attendue (dernière déployée) reçoit bien 100 % du trafic.

### 3.2 Consulter les logs (méthode, URL, status)

```bash
# Backend
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="feedplug-backend-marketing"' \
  --limit=80 --format="table(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)" \
  --project=feedplug-prod

# Filtrer par statut erreur (ex. 4xx/5xx)
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="feedplug-backend-marketing" AND httpRequest.status>=400' \
  --limit=30 --format="table(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)" \
  --project=feedplug-prod
```

Interprétation rapide :

- **OPTIONS** qui reviennent en **429** → le preflight CORS est limité ; vérifier que le handler OPTIONS est bien en premier et que `skip` OPTIONS est actif.
- **5xx** → erreur côté serveur ; regarder `textPayload` ou la stack dans les logs pour la révision concernée.
- **401** sur des routes protégées → comportement attendu si non connecté ; si connecté, vérifier token / cookies.

### 3.3 Smoke test rapide (script)

Après chaque déploiement, lancer depuis la racine du projet :

```bash
./scripts/smoke-test-prod.sh
```

Le script vérifie : **GET /health** (200), **OPTIONS** preflight (204 attendu), et que le frontend répond (200/3xx). En cas d’OPTIONS en 429, le script affiche un avertissement sans faire échouer (voir §1).

### 3.4 Smoke test manuel (exemple backend)

```bash
# Health
curl -sI "https://feedplug-backend-marketing-771607738477.europe-west1.run.app/health"
# → 200

# Preflight CORS (OPTIONS) — doit être 204 avec en-têtes CORS
curl -sI -X OPTIONS "https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/performance/dashboard" \
  -H "Origin: https://app.feedplug.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
# → 204 et présence de Access-Control-Allow-Origin
```

### 3.5 Test dans le navigateur

1. Ouvrir **app.feedplug.com** (ou la page concernée) en **navigation privée** pour éviter cache / anciennes réponses.
2. Ouvrir les **DevTools (F12)** → onglet **Network**.
3. Refaire l’action qui déclenche la feature (ex. aller sur l’onglet Performance).
4. Vérifier :
   - Requête **OPTIONS** (preflight) → status **204** (pas 429 ni 4xx/5xx).
   - Requête **GET/POST** réelle → status **200** (ou 201, etc.) et pas d’erreur CORS dans la console.

---

## 4. S’assurer à l’avenir que la prod fonctionne

### 4.1 Processus recommandé

1. **Avant merge / déploiement** : suivre la checklist §2 (backend + frontend + déploiement).
2. **Juste après déploiement** :
   - Vérifier la révision et le trafic (§3.1).
   - Regarder les logs récents (§3.2) pour la nouvelle feature (URL, méthode, status).
   - Faire un smoke test curl (§3.3) pour les points critiques (health, OPTIONS si CORS).
   - Tester dans le navigateur (§3.4) sur la flow utilisateur concernée.
3. **En cas de problème** : les logs (méthode, URL, status) permettent de voir si le souci vient du rate limit (429), du CORS (OPTIONS non 204), d’une 5xx, etc.

### 4.2 Automatisation possible (plus tard)

- **Cloud Build** : étape après le déploiement qui appelle un script de smoke tests (curl health + OPTIONS + éventuellement une route publique).
- **Monitoring** : alertes sur taux de 4xx/5xx ou sur des URLs critiques (ex. `/api/v1/performance/*`) dans Cloud Monitoring / Logs.
- **E2E (Playwright/Cypress)** : scénario “login → aller sur Performance → vérifier que le dashboard charge” sur un environnement de préprod ou prod (avec prudence).

---

## 5. Références

- Vérification détaillée Performance / redirections : `docs/VERIF_DEPLOIEMENT_PERFORMANCE.md`
- Déploiement backend : `./deploy-backend-marketing.sh` ou `gcloud builds submit --config=cloudbuild-backend-marketing.yaml .`
- Déploiement frontend : `./deploy-frontend.sh`
