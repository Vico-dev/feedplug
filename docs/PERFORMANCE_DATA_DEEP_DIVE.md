# Deep dive : Données de performance par canal (Google Ads, Amazon, Meta)

**Date** : 28 février 2026  
**Objectif** : Travailler ensemble les 3 points du plan d’implémentation avant de coder la feature.

---

## Vue d’ensemble (résumé)

1. **Objectif** : Quand on diffuse des produits (Google, Meta, Amazon…), on récupère aussi les **performances** (impressions, clics, conversions, CA) via les APIs Ads, et on les affiche avec une **évolution dans le temps** (courbes, tendances).

2. **Où ça se passe** : Le sync des métriques et le calcul des scores sont dans **backend-marketing** (Express). Les connexions (tokens Google Ads, Meta Ads, etc.) vivent dans **PlatformConnection**.

3. **Données** :
   - **PerformanceChannel** = dernière valeur par (produit, canal) → score actuel, affichage catalogue.
   - **PerformanceChannelHistory** = une ligne par (produit, canal, **jour**) → graphiques d’évolution. On garde **90 jours**, puis purge automatique.

4. **À faire côté code** : Connecteurs qui appellent Google Ads API, Meta Ads API, Amazon Advertising API → pour chaque produit, écrire dans les deux tables (snapshot + historique). Job quotidien pour purger l’historique au-delà de 90 jours.

---

## 1. Backend-marketing vs NestJS pour le sync perf — Reco

### État des lieux

| Composant | Rôle actuel |
|-----------|-------------|
| **backend-marketing** (Express, `server-minimal.js`) | Ingestion feeds, scoring qualité (ProductScore), règles, export CSV, **push GMC/Amazon**, PlatformConnection, ChannelScoringConfig, création des tables ProductScore/PerformanceChannel en raw SQL. |
| **NestJS** (`src/`) | API principale (auth, users, imports, exports), FeedConnectorService (push Google/Meta/Amazon/Mirakl), connecteurs export. Pas de ProductScore/PerformanceChannel. |

### Recommandation : **sync perf dans backend-marketing**

**Raisons :**

1. **Données déjà là** : ProductScore et PerformanceChannel sont créés et utilisés côté backend-marketing (scoring qualité, raw SQL). Y ajouter l’alimentation des perf évite de dupliquer la logique ou de faire des appels cross-service.
2. **Credentials au même endroit** : PlatformConnection (GMC, Amazon) est lue/écrite dans server-minimal. Pour les APIs Ads, on aura soit les mêmes connexions (si scope suffisant) soit de nouvelles (ex. `google_ads`). Tout resterait dans le même backend.
3. **Cohérence avec ChannelScoringConfig** : La config du scoring par canal est en backend-marketing ; le calcul du score (qualité + perf) sera donc naturellement dans le même service.
4. **NestJS reste la façade** : L’app peut exposer des routes NestJS qui appellent le backend-marketing (ou qui lisent la BDD partagée) pour “déclencher un sync” ou “récupérer les scores”. Pas besoin que la logique lourde (jobs, APIs Ads) soit dans NestJS.

**En résumé :** Implémenter le **sync des métriques** (jobs qui appellent Google Ads API, Meta Ads API, etc. et écrivent dans PerformanceChannel) dans **backend-marketing**. Optionnellement, une API NestJS légère pour “lancer le sync” ou “lire les dernières perf” si le front ne parle qu’à NestJS.

---

## 2. Stratégie de mapping (FeedItem ↔ produit canal) — Reco

### Contraintes

- **FeedItem** : `id`, `feedId`, `originId`, `sku`, `url`, …
- **Google (GMC push)** : on envoie un `offerId` = `originId` ou `item.id` (voir `server-minimal.js` ligne 8339). C’est l’ID produit côté Merchant Center.
- **Google Ads** : le reporting peut être par product_id / offer_id (selon la dimension). On supposera que c’est le même identifiant que l’offerId envoyé au Merchant Center.
- **Amazon** : SP-API utilise sku + marketplace. Amazon Advertising API rapporte souvent par ASIN ou sku.
- **Meta** : Catalog product id (ex. `id` du produit dans le catalogue). Peut être notre `item.id` ou un ID généré à l’envoi.

### Recommandation : **clé de mapping par canal + fallback**

| Canal | Clé principale | Fallback | Note |
|-------|----------------|----------|------|
| **GOOGLE_ADS** | `originId` (ou `id` si pas d’originId) | — | C’est l’offerId qu’on envoie au Content API. Les rapports Google Ads Shopping utilisent le même identifiant. |
| **AMAZON** | `sku` | `originId` | Amazon Ads rapporte par SKU ou ASIN. Stocker l’ASIN dans un custom field si on le récupère à l’import. |
| **META_ADS** | `id` (FeedItem) ou ID catalogue stocké | `sku`, `originId` | Si on push le catalogue, Meta peut retourner un product_id ; le stocker dans `FeedItem.customfields.metaProductId` pour les prochains syncs. |

**Implémentation proposée :**

1. **Pas de table de mapping dédiée au début.** Utiliser les champs existants de FeedItem : `id`, `originId`, `sku`. Si une plateforme renvoie un ID externe (ex. Meta catalog product_id), le stocker dans `FeedItem.customfields`, ex. `{ "metaProductId": "123", "googleOfferId": "xyz" }`.
2. **Fonction de résolution par canal** :  
   `getExternalIdForChannel(item, channel)` → pour GOOGLE_ADS : `item.originId || item.id` ; pour AMAZON : `item.sku || item.originId` ; pour META_ADS : `item.customfields?.metaProductId || item.id`.
3. **Lors du push** : si la plateforme retourne un identifiant produit (ex. Meta), mettre à jour `customfields` avec cet ID pour les syncs perf suivants.

Cela évite une table supplémentaire tout en restant clair et évolutif (on peut ajouter une table `FeedItemExternalId` plus tard si besoin).

---

## 3. Connexions Google / Meta / Amazon aujourd’hui — Vérif

### Ce qui existe

| Plateforme | Connexion (PlatformConnection) | Scope / usage | Ads / reporting ? |
|------------|---------------------------------|---------------|--------------------|
| **Google** | `platform = 'gmc'` | OAuth `https://www.googleapis.com/auth/content` → **Content API** (Merchant Center) | **Non** : push produits uniquement. Pas d’accès Google Ads API. |
| **Amazon** | `platform = 'amazon'` | OAuth LWA (SP-API), seller_id + tokens | **Non** : push Listings. Pas d’Amazon **Advertising** API. |
| **Meta** | Aucune `PlatformConnection` pour `meta` dans le code | — | **Non** : export CSV seulement, pas de connexion API Meta. |

### Conclusion

- Aujourd’hui : **push seulement** (GMC Content API, Amazon SP-API Listings). Aucune API Ads pour récupérer les performances.
- Pour la feature “données de performance” il faudra :
  - **Google Ads API** : OAuth avec scope Google Ads (ex. `https://www.googleapis.com/auth/adwords`), + **customer_id** (compte Google Ads), distinct du merchant_id. → Nouvelle connexion type `google_ads` recommandée (ou étendre avec un “mode” Ads dans la config).
  - **Meta Marketing API** : Token avec `ads_read` (+ catalog si besoin). → Créer une connexion `meta` (ou `meta_ads`) avec stockage du token dans PlatformConnection.
  - **Amazon Advertising API** : Complètement séparée de SP-API (seller). Autres credentials / OAuth. → Nouvelle connexion type `amazon_ads` recommandée.

Donc : **trois nouvelles “connexions” (ou trois usages distincts)** pour les Ads, même si le compte utilisateur est le même (ex. même compte Google pour GMC et Google Ads). On peut garder une seule entrée “Google” en UI et gérer en interne `gmc` vs `google_ads` selon l’usage (push vs sync perf).

---

## 4. Synthèse des décisions

| Point | Décision |
|-------|----------|
| **Où coder le sync perf** | Backend-marketing (Express). Optionnel : API NestJS pour déclencher ou lire. |
| **Mapping FeedItem ↔ canal** | Par canal : Google = originId/id, Amazon = sku (ou ASIN en customfield), Meta = customfields.metaProductId ou id. Pas de table dédiée au départ. |
| **Connexions actuelles** | GMC + Amazon = push seulement. Aucune API Ads. Il faudra ajouter google_ads, meta (ou meta_ads), amazon_ads pour le reporting. |
| **Historisation** | Obligatoire. Table **PerformanceChannelHistory** (1 ligne par produit, canal, jour). Rétention 90 jours + purge (ou partitionnement par mois). |

---

## 5. Prochaines étapes techniques

1. **Backend-marketing** : ajouter un module ou des routes dédiées “performance sync” (ex. `routes/performance-sync.js` ou `jobs/sync-google-ads-perf.js`).
2. **Credentials** : étendre PlatformConnection (ou schéma) pour `google_ads`, `meta`, `amazon_ads` avec les champs nécessaires (customer_id pour Google Ads, token Meta, etc.).
3. **Mapping** : implémenter `getExternalIdForChannel(item, channel)` et l’utiliser dans chaque connecteur de sync.
4. **Tables** : créer **PerformanceChannelHistory** (migration) avec index et contrainte unique `(scoreId, channel, period, date)`. À chaque sync : écriture dans **PerformanceChannel** (UPSERT) + **PerformanceChannelHistory** (UPSERT par jour).
5. **Purge** : job quotidien (cron) qui supprime les lignes de PerformanceChannelHistory avec `date < CURRENT_DATE - 90 jours` (ou drop de partition si partitionnement par mois).
6. **Premier canal** : implémenter le sync **Google Ads** (récupération des métriques par product_id / offer_id, double écriture PerformanceChannel + PerformanceChannelHistory), puis répéter pour Meta et Amazon.

Si tu valides ces points, on peut détailler la structure des fichiers et l’API Google Ads (dimensions, métriques) pour la première implémentation.

---

## 6. Historisation dans le temps (obligatoire pour la feature)

L’historisation est **nécessaire** pour rendre la feature intéressante : évolution des métriques, graphiques par canal, tendances, comparaison de périodes. Le design ci‑dessous permet de l’avoir tout en gardant la DB scalable.

### Double écriture : snapshot actuel + historique

| Table | Rôle | Volume (1 M produits × 3 canaux) |
|-------|------|-----------------------------------|
| **PerformanceChannel** | **Dernière valeur** par (produit, canal, période) — affichage catalogue, score actuel. UPSERT à chaque sync. | ~3 M lignes (~500 MB – 1 GB) |
| **PerformanceChannelHistory** | **Une ligne par (produit, canal, jour)** — graphiques d’évolution, tendances. Insert à chaque sync, rétention limitée. | ~90 M lignes pour 30 j ; ~270 M pour 90 j (avec purge) |

### Schéma proposé pour PerformanceChannelHistory

```sql
-- Une ligne par (scoreId, channel, period, date) où date = jour (truncated).
-- Si on sync plusieurs fois par jour : UPSERT sur (scoreId, channel, period, date::date) pour agréger la journée.
CREATE TABLE IF NOT EXISTS "PerformanceChannelHistory" (
  id            TEXT PRIMARY KEY,
  scoreId       TEXT NOT NULL REFERENCES "ProductScore"(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL CHECK (channel IN ('GOOGLE_ADS','META_ADS','AMAZON','MIRAKL','SHOPIFY','OTHER')),
  period        TEXT NOT NULL,
  date          DATE NOT NULL,   -- jour uniquement (pas timestamp)
  metrics       JSONB NOT NULL,
  channelScore  INTEGER NOT NULL DEFAULT 0 CHECK (channelScore >= 0 AND channelScore <= 100),
  createdAt     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfhistory_unique
  ON "PerformanceChannelHistory" (scoreId, channel, period, date);

CREATE INDEX IF NOT EXISTS idx_perfhistory_scoreid ON "PerformanceChannelHistory"(scoreId);
CREATE INDEX IF NOT EXISTS idx_perfhistory_channel ON "PerformanceChannelHistory"(channel);
CREATE INDEX IF NOT EXISTS idx_perfhistory_date ON "PerformanceChannelHistory"(date);
```

- **Granularité** : 1 point par **jour** et par (produit, canal, période). Si le sync tourne plusieurs fois par jour, on fait un **UPSERT** sur `(scoreId, channel, period, date)` pour ne garder qu’un enregistrement par jour (dernière valeur du jour).
- **Rétention** : garder par exemple **90 jours** (configurable). Au‑delà, suppression par job ou par partition.

### Rétention et purge pour rester scalable

| Paramètre | Valeur proposée | Effet |
|-----------|-----------------|--------|
| **Rétention** | 90 jours (configurable par compte ou global) | Au‑delà, les lignes sont supprimées. |
| **Purge** | Job quotidien (cron) : `DELETE FROM "PerformanceChannelHistory" WHERE date < CURRENT_DATE - INTERVAL '90 days'` | Contrôle du volume. |
| **Partitionnement (optionnel)** | Partition par mois sur `date` | Permet de **dropper** une partition entière au lieu de DELETE massif (plus performant). |

Pour 1 M produits × 3 canaux × 90 jours = **270 M lignes** en régime de croisière. Avec partition par mois (3 partitions “actives”), la purge = `DROP PARTITION` du mois le plus ancien, ce qui est rapide.

### Flux d’écriture à chaque sync

1. **PerformanceChannel** : UPSERT sur `(scoreId, channel, period)` → toujours la dernière valeur.
2. **PerformanceChannelHistory** : UPSERT sur `(scoreId, channel, period, date)` avec `date = DATE(sync_day)` → un point par jour par (produit, canal).
3. **Purge** (job quotidien) : supprimer ou dropper les données avec `date` &lt; aujourd’hui − 90 jours.

### Lecture côté produit / rapport

- **Score et métriques actuels** : lire **PerformanceChannel** (index sur scoreId, channel, period).
- **Courbe d’évolution (ex. 30 derniers jours)** : lire **PerformanceChannelHistory** avec `WHERE scoreId = ? AND channel = ? AND period = ? AND date >= ? AND date <= ?` (index sur scoreId, channel, date).

### Synthèse scale avec historisation

| Élément | Décision |
|--------|----------|
| **PerformanceChannel** | Garder pour la valeur courante (UPSERT). ~3 M lignes. |
| **PerformanceChannelHistory** | Nouvelle table, 1 ligne par (produit, canal, période, jour). Rétention 90 jours + job de purge (ou partitions mensuelles). |
| **Granularité historique** | Jour (pas plusieurs points par jour). Plusieurs syncs/jour → UPSERT sur la même journée. |
| **ProductScore** | Inchangé. |

La DB supporte l’historisation à condition de : (1) limiter la rétention (ex. 90 j), (2) purger régulièrement ou utiliser des partitions par date, (3) indexer correctement pour les requêtes par produit/canal et par plage de dates.

---

## 7. Où en est le code (implémenté)

| Élément | Fichier / lieu | Description |
|--------|----------------|-------------|
| **Vue d’ensemble** | § « Vue d’ensemble » en tête de ce doc | Résumé en 4 points. |
| **Table PerformanceChannelHistory** | `server-minimal.js` (au démarrage) | Création automatique si elle n’existe pas. |
| **Migration SQL** | `backend-marketing/prisma/migrations/027_performance_channel_history.sql` | Référence pour le schéma. |
| **Écriture snapshot + historique** | `backend-marketing/performance/write-perf.js` | `writePerformanceSnapshot(prisma, { scoreId, channel, period, metrics, channelScore })` → écrit dans PerformanceChannel et PerformanceChannelHistory. |
| **Purge** | `backend-marketing/performance/write-perf.js` | `purgePerformanceHistory(prisma, retentionDays)` ; à appeler par un cron. |
| **Lecture historique** | `backend-marketing/performance/write-perf.js` | `getPerformanceHistory(prisma, { scoreId, channel, period, from, to })`. |
| **GET historique (API)** | `GET /api/v1/performance/history?itemId=...&channel=...&period=...&from=...&to=...` | Authentification requise ; retourne les points pour un produit et un canal. |
| **POST purge (API)** | `POST /api/v1/admin/performance/purge?retentionDays=90` | Staff ou `Authorization: Bearer <CRON_SECRET>` ; purge l’historique. |
| **README module** | `backend-marketing/performance/README.md` | Comment utiliser write-perf et les APIs. |
| **Sync Google Ads** | `backend-marketing/performance/sync-google-ads.js` | Récupère shopping_performance_view (LAST_30_DAYS), map product_item_id → FeedItem (originId/id), écriture via writePerformanceSnapshot. |
| **POST sync Google Ads (API)** | `POST /api/v1/performance/sync/google-ads?feedId=xxx` | Credentials : PlatformConnection `google_ads` ou body customerId + refreshToken. Env : GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET. |
| **Sync Meta Ads** | `backend-marketing/performance/sync-meta-ads.js` | Graph API insights avec breakdowns=product_id, map product_id → FeedItem (id / customfields.metaProductId / originId), writePerformanceSnapshot. |
| **POST sync Meta Ads (API)** | `POST /api/v1/performance/sync/meta-ads?feedId=xxx` | Credentials : PlatformConnection `meta` (merchantid = ad account, accesstoken) ou body adAccountId + accessToken. |
| **Sync Amazon Ads** | `backend-marketing/performance/sync-amazon-ads.js` | Reporting v3 : rapport spAdvertisedProduct, LWA token, création rapport async → poll → download GZIP → map ASIN → FeedItem (sku/originId/customfields.asin) → writePerformanceSnapshot. |
| **POST sync Amazon Ads (API)** | `POST /api/v1/performance/sync/amazon-ads?feedId=xxx&region=eu` | Credentials : PlatformConnection `amazon_ads` (merchantid=profileId, refreshtoken, metadata clientId/clientSecret) ou body profileId, clientId, clientSecret, refreshToken. Env : AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET. |

**À faire ensuite** : voir section « Reste à faire » ci-dessous.

---

## 8. Reste à faire

### Priorité haute (pour une feature complète)

| # | Tâche | Détail |
|---|--------|--------|
| 1 | **Onglet Performance + dashboard** | ✅ **Fait** : onglet « Performance » dans la sidebar, page `/performance` avec dashboard par plateforme (ROAS, coût, revenus), top produits, performance par catégorie. API `GET /api/v1/performance/dashboard`. |
| 1b | **Affichage catalogue** | Colonne ou badge « Score Google Ads / Meta / Amazon » par produit (lire PerformanceChannel). Option : filtre par canal. |
| 2 | **Fiche produit – évolution** | Sur la page détail produit : appel à `GET /api/v1/performance/history?itemId=...&channel=...` et affichage d’un **graphique d’évolution** (courbe par jour). |
| 3 | **Boutons sync dans l’UI** | Sur la page Flux ou Scoring canaux : boutons « Synchroniser Google Ads », « Synchroniser Meta », « Synchroniser Amazon » qui appellent les `POST /api/v1/performance/sync/google-ads`, `meta-ads`, `amazon-ads`. Afficher le résultat (synced, skipped, errors). |
| 4 | **Planification (cron)** | Job planifié (ex. quotidien) pour : (a) lancer les 3 syncs par compte ayant une connexion, (b) appeler `POST /api/v1/admin/performance/purge?retentionDays=90` (avec CRON_SECRET). |

### Priorité moyenne

| # | Tâche | Détail |
|---|--------|--------|
| 5 | **Tunnels de connexion (Google Ads, Meta) pour la perf** | ❌ **Pas prêts**. Voir §9 ci‑dessous. Il faut ajouter en front les écrans « Connecter Google Ads » et « Connecter Meta » (et optionnellement Amazon Ads) pour que l’utilisateur lie ses comptes **performance** sans passer les tokens en body. |
| 5b | **OAuth / écrans de connexion** | Écrans « Connecter Google Ads », « Connecter Meta Ads », « Connecter Amazon Ads » pour enregistrer les credentials dans **PlatformConnection** (sans passer les tokens en body). |
| 6 | **Score selon ChannelScoringConfig** | Utiliser la config (qualityWeight, performanceWeight) pour calculer ou recalculer le **channelScore** (au lieu d’une heuristique fixe dans chaque sync). La page Scoring canaux existe déjà ; il reste à brancher ce calcul (job après sync ou dans le sync). |
| 7 | **Page Rapports** | Alimenter la page Rapports avec les vraies données (PerformanceChannel, agrégats par canal) : graphiques d’évolution, top produits par canal, export. |

### Priorité basse / à valider

| # | Tâche | Détail |
|---|--------|--------|
| 8 | **Amazon Ads** | Vérifier le flow (création rapport, statut COMPLETED/DONE, récupération URL de téléchargement) avec la doc officielle et ajuster `sync-amazon-ads.js` si besoin. |
| 9 | **Partitionnement** | Si le volume PerformanceChannelHistory devient lourd : partitionner par mois et purger en droppant une partition. |

---

## 9. Tunnels de connexion pour la perf (Google, Meta) — État actuel

**Réponse courte : non, les tunnels pour connecter les comptes **performance** (Google Ads, Meta Ads) ne sont pas prêts en front.**

### Ce qui existe aujourd’hui (page Flux)

| Plateforme | Connexion existante | Usage | Utilisable pour la perf ? |
|------------|---------------------|--------|---------------------------|
| **Google** | « Connecter Google » → OAuth **GMC** (Content API) | Push produits vers Merchant Center | **Non** : scope Content, pas Google Ads API. La perf nécessite une connexion **google_ads** (customer_id + refresh_token avec scope Ads). |
| **Amazon** | « Connecter Amazon » → OAuth **SP-API** (Seller) | Push produits (listings) | **Non** : c’est le compte vendeur. La perf nécessite **Amazon Advertising API** (platform `amazon_ads`, profileId + LWA). |
| **Meta** | Aucune connexion | — | **Non** : aucun tunnel Meta en front (pas de status, auth-url, callback). |

### Ce qu’il faut pour que l’utilisateur « connecte la perf »

1. **Google Ads**  
   - Nouvelle connexion **platform = `google_ads`** (distincte de GMC).  
   - En front : écran « Connecter Google Ads » qui déclenche un OAuth avec scope Google Ads (ex. `https://www.googleapis.com/auth/adwords`), puis callback qui enregistre `customer_id` + `refresh_token` dans PlatformConnection.  
   - Backend : routes `GET /api/v1/platforms/google_ads/auth-url`, `GET .../callback`, `GET .../status`, `DELETE .../disconnect` (sur le même modèle que GMC).

2. **Meta Ads**  
   - Connexion **platform = `meta`** (ou `meta_ads`).  
   - En front : écran « Connecter Meta » : soit OAuth Facebook (login avec `ads_read` + accès au catalogue), soit saisie d’un **token d’accès** + **ID compte publicitaire** (act_xxx).  
   - Backend : routes `GET /api/v1/platforms/meta/status`, `POST .../connect` (body: accessToken, adAccountId), `DELETE .../disconnect`.

3. **Amazon Ads** (optionnel)  
   - Connexion **platform = `amazon_ads`** (distincte d’Amazon Seller).  
   - En front : formulaire ou OAuth pour LWA (clientId, clientSecret, refreshToken, profileId).  
   - Backend : stockage dans PlatformConnection (merchantid = profileId, refreshtoken, metadata.clientId/clientSecret).

### Où placer les connexions « perf » en front

- **Option A** : Sur la page **Performance** : un bloc « Connexions » avec cartes « Connecter Google Ads », « Connecter Meta », « Connecter Amazon Ads » (comme sur Flux pour GMC/Amazon).  
- **Option B** : Sur la page **Flux** : ajouter une section « Données de performance » avec les mêmes cartes, pour garder toutes les connexions au même endroit.  
- **Option C** : Page dédiée **Paramètres > Connexions** (ou **Intégrations**) listant GMC, Amazon Seller, Google Ads, Meta, Amazon Ads.

En résumé : **les tunnels de connexion pour la perf (Google Ads, Meta) ne sont pas prêts en front**. Il faut ajouter les écrans et les routes backend pour `google_ads` et `meta` (et optionnellement `amazon_ads`) pour que l’utilisateur puisse connecter ses comptes et alimenter le dashboard Performance sans passer les tokens à la main.
