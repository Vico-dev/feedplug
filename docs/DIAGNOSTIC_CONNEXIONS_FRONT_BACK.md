# Diagnostic : Connexions fragiles Frontend ↔ Backend

**Problème** : Les connexions entre le frontend et le backend semblent fragiles, avec des erreurs qui surviennent quasi à chaque déploiement.

---

## 1. Ce que les logs et tests ont révélé

### Smoke test (état actuel)

```bash
./scripts/smoke-test-prod.sh
```

**Résultat typique avant correctif** :
- ✅ GET /health → 200
- ⚠️ **OPTIONS /api/v1/performance/dashboard → 429** (attendu : 204 pour CORS)
- ✅ Frontend → 200

### Cause identifiée

Les requêtes **OPTIONS** (preflight CORS) recevaient **429 Too Many Requests** au lieu de **204**. Conséquences :

1. Le navigateur envoie une requête OPTIONS avant chaque appel API cross-origin
2. Si OPTIONS renvoie 429, le navigateur bloque la requête réelle (GET/POST)
3. L’utilisateur voit des erreurs "Failed to fetch", "Impossible de se connecter au serveur", ou des pages vides

**Origine** : Les requêtes OPTIONS passaient par un rate limiter (ou autre middleware) avant le handler CORS, ce qui provoquait des 429.

---

## 2. Correctifs appliqués

### 2.1 Handler OPTIONS en premier

Le handler CORS preflight (OPTIONS) est placé **en tout premier** dans la chaîne Express (`server-minimal.js`), juste après la définition de `isOriginAllowed`, pour qu’aucun autre middleware ne puisse intercepter les OPTIONS avant.

### 2.2 Rate limiter avec skip OPTIONS

Un rate limiter global sur `/api/v1` a été ajouté avec `skip: (req) => req.method === 'OPTIONS'`, afin que les requêtes preflight ne soient jamais comptées dans la limite.

---

## 3. Points de fragilité connus

| Problème | Impact | Solution |
|----------|--------|----------|
| **NEXT_PUBLIC_API_URL** | Si mal défini au build, le frontend appelle une mauvaise URL | Définir dans `deploy-frontend.sh` et `frontend/Dockerfile` |
| **Typo 771687738477** | Ancienne typo dans l’URL Cloud Run | Correction dans `api.ts` (771607738477) |
| **OPTIONS 429** | Preflight bloqué → CORS en échec | Handler OPTIONS en premier + skip dans rate limiter |
| **Ordre de déploiement** | Backend déployé avant frontend ou l’inverse | Déployer backend puis frontend ; vérifier avec smoke test |
| **Cold start** | 503 au premier appel après inactivité | `min-instances: 1` sur le backend (déjà configuré) |

---

## 4. Vérifications après déploiement

### 4.1 Smoke test

```bash
./scripts/smoke-test-prod.sh
```

Tous les tests doivent passer (y compris OPTIONS en 204).

### 4.2 Test manuel CORS

```bash
curl -sI -X OPTIONS "https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/performance/dashboard" \
  -H "Origin: https://app.feedplug.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization"
```

Attendu : **204** et présence de `Access-Control-Allow-Origin`.

### 4.3 Logs Cloud Run

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="feedplug-backend-marketing"' \
  --limit=50 --format="table(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)" \
  --project=feedplug-prod
```

Vérifier que les OPTIONS apparaissent en **204** et non en 429.

---

## 5. Ordre de déploiement recommandé

1. **Backend** : `./deploy-backend-marketing.sh` ou `gcloud builds submit --config=cloudbuild-backend-marketing.yaml .`
2. Attendre la fin du déploiement (2–3 min)
3. **Frontend** : `./deploy-frontend.sh`
4. Lancer le smoke test : `./scripts/smoke-test-prod.sh`
5. Tester manuellement sur app.feedplug.com (navigation privée)

---

## 6. Références

- `docs/DEPLOIEMENT_VALIDATION_PROD.md` — Checklist et validation
- `docs/VERIF_DEPLOIEMENT_PERFORMANCE.md` — Vérifications Performance
- `backend-marketing/DEPLOI_CHECKLIST.md` — Config prod
