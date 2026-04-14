# CORS : Pourquoi c'est récurrent et comment le rendre robuste

## 0. Solution retenue : proxy Next.js (plus de CORS côté navigateur)

**En place depuis mars 2026** : le frontend (navigateur) n’appelle plus le backend Cloud Run en direct. Toutes les requêtes passent par une route Next.js **même origine** :

- **Route** : `src/app/feedplug-api/[[...path]]/route.ts` — proxy vers le backend (chemin **hors** `/api/` pour éviter que le load balancer n’envoie au backend).
- **Client** : `src/lib/api.ts` — en browser, `getApiBaseUrl()` retourne `origin + '/feedplug-api'`.

Résultat : **aucune requête cross-origin** depuis le navigateur vers le backend, donc **plus de blocage CORS**. Le backend reste inchangé ; seul le frontend utilise le proxy quand il tourne dans le navigateur.

Pour un nouvel environnement (ex. autre domaine), redéployer le frontend : le proxy reste sur le même domaine que l’app.

---

## 1. Causes structurelles des problèmes récurrents

### 1.1 CORS dispersé en 4+ endroits

| Emplacement | Fichier | Rôle |
|-------------|---------|------|
| **HTTP (avant Express)** | server-minimal.js L19-36 | Handler OPTIONS dans `http.createServer` |
| **Express top-level** | server-minimal.js L39-47 | Middleware `cors()` |
| **Express run()** | server-minimal.js L568-581 | Handler OPTIONS manuel "en premier" |
| **Express run()** | server-minimal.js L583-593 | En-têtes CORS pour GET/POST/etc. |

**Problème** : Toute modification (nouveau middleware, changement d'ordre) peut casser une des couches sans que les autres compensent.

### 1.2 Deux `isOriginAllowed` différents

- **Top-level** (L12-17) : logique inline, utilisée par le handler HTTP
- **run()** (L556-565) : `_corsOrigins` + patterns `.feedplug.com`, `.run.app`

**Problème** : Les deux peuvent diverger. Une nouvelle origine ajoutée à un seul endroit = CORS cassé.

### 1.3 Origines en dur, `CORS_ORIGIN` ignoré

```javascript
const _corsOrigins = [
  'https://app.feedplug.com',
  'https://feedplug.com',
  'https://www.feedplug.com',
  'https://feedplug-frontend-771607738477.europe-west1.run.app'  // ID Cloud Run en dur
];
```

- `CORS_ORIGIN` est défini dans cloudbuild (`CORS_ORIGIN=https://app.feedplug.com`) mais **n'est pas utilisé** pour construire la liste
- Chaque nouvel environnement (staging, preview) = modification de code
- L'URL Cloud Run `771607738477` peut changer (nouveau projet, migration)

### 1.4 Dépendance à l'ordre des middlewares

- Le handler OPTIONS doit être **avant** le rate limiter
- Tout `app.use()` ajouté avant peut intercepter les OPTIONS
- Pas de mécanisme pour garantir l'ordre (ex. "CORS toujours en premier")

### 1.5 Frontend : redirections et routes

- `middleware.ts` : `APP_ROUTES` doit inclure chaque nouvelle route app
- Si une route manque → redirection vers feedplug.com → l'appel API part de feedplug.com → Origin différent → CORS peut échouer
- Exemple passé : `/scoring-canaux` oublié = erreurs CORS

---

## 2. Approche robuste proposée

### 2.1 Un seul module CORS (recommandé)

Créer `backend-marketing/lib/cors.js` :

```javascript
// Une seule source de vérité pour les origines
const CORS_ORIGINS = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Fallback prod si vide
const DEFAULT_ORIGINS = [
  'https://app.feedplug.com',
  'https://feedplug.com',
  'https://www.feedplug.com',
];

const origins = CORS_ORIGINS.length ? CORS_ORIGINS : DEFAULT_ORIGINS;

// Patterns dynamiques (sous-domaines, Cloud Run)
function isOriginAllowed(origin) {
  if (!origin) return false;
  const o = origin.toLowerCase();
  if (origins.some(a => a.toLowerCase() === o)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith('.feedplug.com') || u.hostname === 'feedplug.com') return true;
    if (u.hostname.endsWith('.run.app')) return true;
  } catch (_) {}
  return false;
}

// Middleware unique : OPTIONS → 204, autres → headers + next
function corsMiddleware(req, res, next) {
  const origin = (req.headers.origin || '').trim();
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
}

module.exports = { corsMiddleware, isOriginAllowed, origins };
```

**Avantages** :
- Une seule définition des origines
- `CORS_ORIGINS` en env (ex. `https://app.feedplug.com,https://staging.feedplug.com`)
- Pas de duplication

### 2.2 Utiliser `CORS_ORIGINS` dans Cloud Build

```yaml
# cloudbuild-backend-marketing.yaml
- 'CORS_ORIGINS=https://app.feedplug.com,https://feedplug.com,https://www.feedplug.com'
```

Pour la staging : ajouter l'URL dans la variable, pas dans le code.

### 2.3 Checklist pour nouvelles routes

Documenter dans `DEPLOI_CHECKLIST.md` :

1. **Route API** : aucune action CORS (déjà couvert par le middleware global)
2. **Route app (frontend)** : ajouter le path dans `APP_ROUTES` (middleware.ts) pour éviter la redirection feedplug.com → app.feedplug.com

### 2.4 Alternative long terme : API Gateway

Cloud Endpoints ou API Gateway devant Cloud Run :
- CORS configuré une fois au niveau du gateway
- Rate limiting au niveau infrastructure
- Le backend ne gère plus CORS

---

## 3. Actions immédiates (sans refonte)

| Action | Effort | Impact |
|--------|--------|--------|
| Utiliser `CORS_ORIGIN` / `CORS_ORIGINS` pour construire la liste | 1h | Nouvelles origines sans toucher au code |
| Créer `lib/cors.js` et remplacer les 4 couches par ce module | 2h | Une seule source de vérité |
| Ajouter une checklist "nouvelle route app → APP_ROUTES" | 15 min | Moins d'oublis |
| Smoke test OPTIONS dans la CI (Cloud Build) | 1h | Détection automatique des régressions |

---

## 4. Ce qui a été mis en place (réduction de la récurrence)

- **`backend-marketing/lib/cors.js`** : source unique pour les origines (`CORS_ORIGINS` / `CORS_ORIGIN` en env, fallback sur la liste actuelle) et pour `isOriginAllowed` + middleware (OPTIONS → 204, autres → headers + next).
- **`server-minimal.js`** : le handler HTTP et Express utilisent `corsLib` ; un seul `app.use(corsLib.corsMiddleware)` dans `run()` juste après `trust proxy`. **Ne pas ajouter de `app.use()` avant ce middleware.**
- **Cloud Build** : après le déploiement, une étape vérifie health (200) et OPTIONS (204). Si OPTIONS ≠ 204, le build échoue → on ne laisse plus passer un déploiement qui casse CORS sans le voir.

---

## 5. Références

- `docs/DIAGNOSTIC_CONNEXIONS_FRONT_BACK.md`
- `docs/DEPLOIEMENT_VALIDATION_PROD.md`
- `backend-marketing/DEPLOI_CHECKLIST.md`
