# Vérification multi-tenancy — Filtrage par accountId

**Date** : 20 février 2026  
**Objectif** : Confirmer que tous les endpoints sensibles du backend (Express `backend-marketing/server-minimal.js`) filtrent correctement par `accountId` pour éviter toute fuite de données entre comptes.

---

## 1. Mécanismes en place

- **`requireAuth`** : middleware appliqué à `/api/v1/ingestion`, `/enrichment`, `/optimization`, `/rules`. Vérifie le JWT et pose `req.accountId = decoded.accountId`. Bloque si `accountId` absent.
- **`authenticateToken`** : vérifie le JWT et pose `req.user` et `req.accountId`. Utilisé sur les routes accounts, auth/me, onboarding, billing, ab-tests, scoring-canaux, etc.
- **Helpers** :
  - `verifyFeedAccess(feedId, accountId)` — le flux appartient au compte
  - `verifySourceAccess(sourceId, accountId)` — la source appartient au compte
  - `verifyItemAccess(itemId, accountId)` — l’item appartient au compte (via Feed)
  - `verifyEnrichmentSourceAccess(esId, accountId)` — la source d’enrichissement appartient au compte
- **Middleware** : `app.use('/api/v1/ingestion/feeds/:id', ...)` appelle `verifyFeedAccess(req.params.id, req.accountId)` pour toutes les sous-routes `feeds/:id/*`.
- **Staff** : endpoints admin/leads/diagnostic protégés par `requireStaffAccess` (email ou accountId dans liste staff), pas d’accès aux données d’autres comptes clients.

---

## 2. Endpoints vérifiés conformes

| Zone | Endpoints | Filtrage |
|------|-----------|----------|
| **Ingestion** | GET/POST/PUT/DELETE sources, feeds | `req.accountId` ou `verifySourceAccess` / `verifyFeedAccess` |
| | GET feeds/:id/items, export, runs, enrichment-sources, apply-enrichment | Middleware feed + `req.accountId` dans les requêtes |
| | GET/PUT/DELETE enrichment-sources | `verifyFeedAccess` + `verifyEnrichmentSourceAccess` |
| | GET items/:id, items/:id/debug, items/:id/score, items/:id/score-history | `verifyItemAccess` ou JOIN Feed + accountid |
| | PUT/PATCH/DELETE items/:id, restore, revert-to-feed, revisions | `resolveItemId` + `verifyItemAccess` |
| | GET catalogue/score, POST recalculate-all-scores, create-missing-feeds | `verifyFeedAccess` si feedId, WHERE f.accountid |
| | POST upload-csv, analyze-csv | Création avec `req.accountId` |
| | POST scheduled-runs | Emails du compte, feeds du compte |
| **Enrichment** | segments, filter-items, batch, scores | `req.accountId` ou `verifyItemAccess` selon endpoint |
| **Optimization** | titles/generate, optimize-title, optimize-description, etc. | `verifyItemAccess` avant traitement |
| **Rules** | apply, GET/POST/PATCH/DELETE rules, preview | `accountId` dans les requêtes SQL |
| **Accounts** | GET/PUT accounts, GET/PUT/DELETE users, invite | `req.user.accountId` / `req.accountId`, WHERE accountid |
| **Auth** | me, me/password | User du token |
| **Onboarding / Billing** | progress, billing, checkout | `req.user.accountId` |
| **Platforms** | GMC/Amazon auth, status, push, disconnect | `requireAuth` + state/callback avec accountId |
| **Dashboard** | overview | WHERE accountid = req.accountId |
| **AB-tests** | Toutes les routes | `getAccountId(req)`, where: { accountId } |
| **Scoring canaux** | GET/PUT scoring-canaux | `accountId(req)` dans findMany/upsert |

---

## 3. Corrections appliquées lors de cette vérification

Les endpoints suivants accédaient à des données par ID d’item sans vérifier l’appartenance au compte. **Corrections effectuées** :

| Endpoint | Problème | Correction |
|----------|----------|------------|
| `GET /api/v1/ingestion/items/:id/enrichment-analysis` | Récupération FeedItem par id/mpn/sku sans filtre compte | Ajout de `verifyItemAccess` (UUID) et requête avec `JOIN Feed` + `f.accountid = $2` (mpn/sku). |
| `POST /api/v1/ingestion/items/:id/enrich` | Idem | Même logique : `verifyItemAccess` + requêtes scopées au compte. |
| `GET /api/v1/enrichment/score/:itemId` | `SELECT * FROM FeedItem WHERE id = $1` sans contrôle compte | Ajout de `verifyItemAccess(itemId, accountId)` puis requête avec `JOIN Feed` et `f.accountid = $2`. |
| `GET /api/v1/ingestion/items/:id/enrichment-history` | Lecture EnrichmentHistory par itemId sans vérifier l’item | Résolution de l’item via `resolveItemId`, puis `verifyItemAccess(itemId, accountId)` avant toute lecture. |

---

## 4. Synthèse

- **Conformes** : ingestion (sources, feeds, items déjà corrigés en fév. 2026), enrichment (segments, filter-items, batch, etc.), optimization, rules, accounts, auth, onboarding, billing, platforms, dashboard, ab-tests, scoring-canaux.
- **Corrigés ce jour** : 4 endpoints (enrichment-analysis, enrich, enrichment/score/:itemId, enrichment-history).
- **Recommandation** : pour toute nouvelle route qui lit ou écrit des données liées à un feed/item/source, utiliser systématiquement `req.accountId` et les helpers `verifyFeedAccess` / `verifySourceAccess` / `verifyItemAccess` (ou clause explicite `JOIN Feed f ... AND f.accountid = $n`).

La multi-tenancy est **confirmée et renforcée** sur les endpoints sensibles du backend Express.
