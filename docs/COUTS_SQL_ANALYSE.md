# Analyse des coûts SQL (Cloud SQL / requêtes)

Ce doc résume **pourquoi le nombre de requêtes SQL peut exploser** et où agir en priorité.

---

## 1. Causes principales identifiées

### 1.1 Règles appliquées à l’ingestion (`applyRulesOnIngestion`)

- **Fichier:** `backend-marketing/rules/engine.js`
- **Déclencheur:** À chaque ingestion (CSV, Shopify, etc.).
- **Comportement:** Charge **tous** les items du flux (sans limite), puis pour **chaque** item modifié : 1 `UPDATE` + 1 `createRevision` (INSERT).
- **Impact:** 7 000 produits → **14 000+ requêtes** par ingestion.

### 1.2 Application des règles en manuel (POST /api/v1/rules/apply)

- **Fichier:** `backend-marketing/rules/routes.js`
- **Comportement:** Jusqu’à **5 000** items par appel, puis 1 `UPDATE` + 1 révision par item.
- **Impact:** 5 000 × 2 = **10 000 requêtes** par clic « Appliquer les règles ».

### 1.3 Enrichissement « tous les items » (enrich-all / enrich-all-advanced)

- **Fichier:** `backend-marketing/server-minimal.js` (routes enrich-all)
- **Comportement:** Jusqu’à **1 000** items par appel, 1 `UPDATE` par item enrichi.
- **Impact:** Jusqu’à **1 000+ requêtes** par exécution.

### 1.4 Sources d’enrichissement (`applyEnrichmentSources`)

- **Fichier:** `backend-marketing/enrichment/enrichment-sources.js`
- **Comportement:** Pour **chaque** source × **chaque** item : 1 `UPDATE` (+ révision).
- **Impact:** 5 000 items × 2 sources = **10 000+ requêtes** par « Appliquer les sources d’enrichissement ».

### 1.5 Sync performance (Meta / Google / Amazon Ads)

- **Fichiers:** `backend-marketing/performance/sync-meta-ads.js`, sync-google-ads.js, sync-amazon-ads.js
- **Comportement:** Pour **chaque** ligne renvoyée par l’API (impressions, clics, etc.) : 2–4 requêtes (SELECT item, SELECT/INSERT ProductScore, write snapshot).
- **Impact:** 3 000 lignes Meta → **9 000–12 000 requêtes** par sync.

### 1.6 Ingestion CSV

- **Fichier:** `backend-marketing/ingestion/csv.js`
- **Comportement:** Pour **chaque** ligne CSV : 1 `SELECT` (existant) + 1 `INSERT` ou `UPDATE` + éventuellement `createRevision`.
- **Impact:** 10 000 lignes → **20 000–30 000 requêtes** par import.

### 1.7 Limites d’API très hautes

- **GET /api/v1/ingestion/feeds/:id/items** : `limit` par défaut **10 000** → 1 à 2 grosses requêtes par appel.
- **GET /api/v1/ingestion/feeds/:id/export** : `limit` jusqu’à **50 000** voire **100 000** → une seule requête peut ramener des dizaines de milliers de lignes.

### 1.8 Dashboard (stats compte)

- **Fichier:** `backend-marketing/server-minimal.js` (route dashboard / stats)
- **Comportement:** Boucle par batch de 500 items pour calculer le score moyen → plusieurs requêtes par chargement de dashboard (ex. 7 000 produits = 14+ requêtes rien que pour le score).

---

## 2. Pistes de réduction (priorité)

| Priorité | Action | Effet attendu |
|----------|--------|----------------|
| 1 | **Règles à l’ingestion** : traiter par batch (ex. 200–500), faire des `UPDATE` en batch (un seul UPDATE avec `WHERE id IN (...)`) ou limiter le nombre d’items traités par run | Forte baisse du pic à chaque ingestion |
| 2 | **POST /rules/apply** : idem, batch des UPDATE (ex. 100–200 par requête) au lieu d’1 UPDATE par item | Forte baisse par clic « Appliquer » |
| 3 | **Enrichment sources** : batch des UPDATE (ex. 50–100 par requête) au lieu d’1 par item | Forte baisse par « Appliquer sources » |
| 4 | **Sync Meta/Google/Amazon** : précharger les `itemId` / `ProductScore` en 1–2 requêtes (map en mémoire), puis batch INSERT/UPDATE des snapshots | Forte baisse par sync perf |
| 5 | **Ingestion CSV** : utiliser `INSERT ... ON CONFLICT ... DO UPDATE` (upsert) par batch (ex. 500 lignes) au lieu d’1 SELECT + 1 INSERT/UPDATE par ligne | Forte baisse par import CSV |
| 6 | **Limites** : baisser le défaut de `limit` pour items (ex. 1 000) et pour export (ex. 10 000 max), et paginer côté front | Réduction des grosses requêtes |
| 7 | **Dashboard** : mettre en cache (Redis ou table agrégée) le score moyen / stats par compte (TTL 5–15 min) pour éviter de recalculer à chaque visite | Moins de requêtes à chaque chargement |

---

## 3. Vérifier côté GCP

- **Cloud SQL** : onglet « Requêtes » / « Insights » pour voir les requêtes les plus coûteuses ou les plus fréquentes.
- **Facturation** : filtrer par « Cloud SQL » pour confirmer que la hausse vient bien des requêtes / de l’utilisation instance.

---

## 4. Résumé

L’explosion des coûts SQL vient surtout de :

1. **Boucles avec 1 requête par item** (règles, enrichissement, sync perf, ingestion CSV).
2. **Limites par requête très élevées** (10k items, 50k export).
3. **Pas de mise en cache** pour les stats dashboard.

En priorisant les **batch UPDATE/INSERT** et une **limitation + pagination** des gros volumes, on peut réduire fortement le nombre de requêtes sans changer le comportement métier.

---

## 5. Optimisations appliquées (mars 2026)

- **Règles (apply + on ingestion)** : `batchUpdateFeedItems` dans `rules/engine.js` — UPDATE par batch de 80 au lieu d’1 par item. Révisions créées uniquement si ≤ 500 items (ingestion).
- **POST /rules/apply** : utilise `batchUpdateFeedItems`, limite passée de 5000 à 2000 items par appel.
- **Enrichment sources** : UPDATE par batch de 100 dans `enrichment/enrichment-sources.js`.
- **enrich-all et enrich-all-advanced** : UPDATE FeedItem par batch de 100 ; EnrichmentHistory inséré par batch de 100.
- **Limites** : liste items défaut 10 000 → 2 000 (max 10 000) ; export défaut 50 000 → 10 000 (max 50 000).

---

## 6. Scale à zéro Cloud Run (réduire les frais quand l’app n’est pas utilisée)

- **Backend** (`cloudbuild-backend-marketing.yaml`) : `--min-instances` passé de `1` à `0`. Aucune instance ne tourne quand il n’y a pas de trafic → plus de frais compute Cloud Run au repos. Premier appel après inactivité = cold start (~5–15 s).
- **Frontend** (`deploy-frontend.sh`) : `--min-instances 0` ajouté explicitement pour le même comportement.

**Pour appliquer** : redéployer le backend (`./deploy-backend-marketing.sh` ou Cloud Build) et le frontend (`./deploy-frontend.sh`). Ensuite, en l’absence de trafic, les services Cloud Run ne facturent plus de compute (hors Cloud SQL et stockage).
