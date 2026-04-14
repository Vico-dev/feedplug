# Vérification pré-déploiement — Performance & redirections

**Date** : 2026-03-01  
**Objectif** : S’assurer que l’onglet Performance et les redirections feedplug.com → app.feedplug.com sont corrects avant déploiement.

---

## 1. Middleware (redirections)

| Vérification | Statut |
|--------------|--------|
| `/performance` est dans `APP_ROUTES` (middleware.ts) | ✅ |
| Toutes les routes sidebar présentes dans APP_ROUTES : dashboard, sources, catalogue, flux, optimiser, ia, rapports, **performance**, scoring-canaux, notifications, facturation, parametres, admin | ✅ |
| Redirection feedplug.com → app.feedplug.com pour les routes app : `pathnameWithoutLocale` utilisé, hostname = app.feedplug.com | ✅ |
| Query string et hash préservés (new URL(request.url)) | ✅ |

---

## 2. API — URL backend et typo

| Vérification | Statut |
|--------------|--------|
| `API_BASE_URL` centralisé dans `frontend/src/lib/api.ts` | ✅ |
| Correction typo 771687738477 → 771607738477 au runtime si présente | ✅ |
| Aucun `process.env.NEXT_PUBLIC_API_URL` direct ailleurs (tout passe par API_BASE_URL) | ✅ |
| Flux, roadmap, performance, dashboard, etc. utilisent `API_BASE_URL` depuis `@/lib/api` | ✅ |
| URL correcte en fallback : `771607738477` | ✅ |

---

## 3. Page Performance (frontend)

| Vérification | Statut |
|--------------|--------|
| Appel API : `authFetch(\`${API_BASE_URL}/performance/dashboard\`)` | ✅ |
| Gestion 401 → message "Connectez-vous…" | ✅ |
| Gestion erreur réseau / "Failed to fetch" → message explicite | ✅ |
| Loading → PageLoading (design tokens via globals.css) | ✅ |
| Error → PageError + bouton Réessayer | ✅ |
| Pas de throw au premier render (useTranslations, etc. sous layout) | ✅ |

---

## 4. Backend

| Vérification | Statut |
|--------------|--------|
| CORS : `app.feedplug.com`, `feedplug.com`, `www.feedplug.com`, Cloud Run frontend | ✅ |
| Route `GET /api/v1/performance/dashboard` protégée par `requireAuth` | ✅ |
| `backend-marketing/Dockerfile` : `COPY performance ./performance/` | ✅ |
| Dossier `backend-marketing/performance/` avec `write-perf.js`, sync-*.js | ✅ |

---

## 5. Scripts de déploiement

| Vérification | Statut |
|--------------|--------|
| `deploy-frontend.sh` : `NEXT_PUBLIC_API_URL=...771607738477...` | ✅ |
| `deploy-score-history-and-app.sh` : idem 771607738477 | ✅ |
| `frontend/Dockerfile` : ARG/ENV 771607738477 | ✅ |

---

## 6. Logs Cloud Run (diagnostic)

Pour vérifier ce que reçoit le backend (méthode, URL, status) :

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="feedplug-backend-marketing"' \
  --limit=50 --format="table(timestamp,httpRequest.requestMethod,httpRequest.requestUrl,httpRequest.status)" \
  --project=feedplug-prod
```

**Exemple de diagnostic** : si les requêtes **OPTIONS** apparaissent avec le statut **429**, le rate limiter répond avant le handler CORS preflight. Vérifier que le handler OPTIONS est bien en tout premier dans `server-minimal.js` et que la révision déployée contient ce code (build sans cache si besoin). Voir aussi `docs/DEPLOIEMENT_VALIDATION_PROD.md`.

---

## 7. Récap des fichiers modifiés (à déployer)

- **Frontend** (déployer avec `./deploy-frontend.sh`) :
  - `middleware.ts` — ajout de `/performance` dans APP_ROUTES
  - `src/lib/api.ts` — correction typo 771687738477 → 771607738477
  - `src/app/[locale]/(dashboard)/flux/page.tsx` — utilise API_BASE_URL
  - `src/app/(dashboard)/flux/page.tsx` — idem
  - `src/app/(marketing)/docs/roadmap/page.tsx` — idem
  - `src/app/[locale]/(dashboard)/performance/page.tsx` — message d’erreur "Failed to fetch" amélioré

- **Backend** : déjà déployé avec `COPY performance ./performance/` (révision 00396). Aucune modif nécessaire pour ce déploiement.

---

## Commande de déploiement

```bash
cd /Users/victorsoldet/Desktop/Feedplug && ./deploy-frontend.sh
```

Après déploiement :

1. **feedplug.com/performance** (ou /fr/performance) doit rediriger en 301 vers **app.feedplug.com/performance**.
2. Sur **app.feedplug.com**, l’onglet Performance doit charger le dashboard (ou afficher un message d’erreur clair si API indisponible).
3. Les appels API doivent cibler `feedplug-backend-marketing-771607738477.europe-west1.run.app` (pas 771687738477).
