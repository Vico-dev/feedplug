# Module Performance par canal

Ce module gère l’**écriture** et la **lecture** des métriques de performance par canal (Google Ads, Meta Ads, Amazon, etc.) et leur **historisation** pour les graphiques d’évolution.

## Fichiers

- **write-perf.js** : écriture dans `PerformanceChannel` (dernière valeur) et `PerformanceChannelHistory` (un point par jour), purge de l’historique, lecture de l’historique.

## Utilisation

### Écrire un snapshot (depuis un job de sync)

```js
const { writePerformanceSnapshot } = require('./performance/write-perf');

await writePerformanceSnapshot(prisma, {
  scoreId: productScoreId,  // ID ProductScore (lié au FeedItem)
  channel: 'GOOGLE_ADS',
  period: 'LAST_30_DAYS',
  metrics: { impressions: 1000, clicks: 50, conversions: 5, cost: 120.5 },
  channelScore: 72,
});
```

À chaque appel, la **dernière valeur** est mise à jour dans `PerformanceChannel`, et un **point par jour** est enregistré dans `PerformanceChannelHistory` (même jour = upsert).

### Lire l’historique (pour un graphique)

- **API** : `GET /api/v1/performance/history?itemId=xxx&channel=GOOGLE_ADS&period=LAST_30_DAYS&from=YYYY-MM-DD&to=YYYY-MM-DD`  
  (authentification requise ; `itemId` = ID du FeedItem.)

### Purge (job quotidien)

- **API** : `POST /api/v1/admin/performance/purge?retentionDays=90`  
  Avec header `Authorization: Bearer <CRON_SECRET>` ou en tant que staff.  
  Supprime les lignes de `PerformanceChannelHistory` dont la date est antérieure à aujourd’hui − 90 jours.

## Sync Google Ads (implémenté)

Le module **sync-google-ads.js** récupère les métriques Shopping (shopping_performance_view) sur les 30 derniers jours et appelle `writePerformanceSnapshot` pour chaque produit trouvé.

- **API** : `POST /api/v1/performance/sync/google-ads`  
  - Optionnel : `feedId` (query ou body) pour limiter aux items d’un feed.  
  - Credentials : soit **PlatformConnection** `platform = 'google_ads'` (merchantid = customer_id, refreshtoken), soit body `customerId` + `refreshToken`.  
  - Env : `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` (ou `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

- **Mapping** : `product_item_id` (Google Ads) = `FeedItem.originId` ou `FeedItem.id`. Les produits sans correspondance sont ignorés (skipped).

## Sync Meta Ads (implémenté)

Le module **sync-meta-ads.js** récupère les insights par **product_id** (Graph API `/{ad_account_id}/insights?breakdowns=product_id`) sur les 30 derniers jours et appelle `writePerformanceSnapshot` pour chaque produit.

- **API** : `POST /api/v1/performance/sync/meta-ads`  
  - Optionnel : `feedId` (query ou body).  
  - Credentials : soit **PlatformConnection** `platform = 'meta'` (merchantid = ad account id `act_xxx`, accesstoken), soit body `adAccountId` + `accessToken`.

- **Mapping** : `product_id` (Meta) = `FeedItem.id` ou `FeedItem.customfields.metaProductId` ou `FeedItem.originId`.

## Sync Amazon Ads (implémenté)

Le module **sync-amazon-ads.js** utilise l’API Reporting v3 : création d’un rapport **spAdvertisedProduct** (Sponsored Products par ASIN), attente de complétion, téléchargement GZIP, puis `writePerformanceSnapshot` pour chaque ASIN mappé.

- **API** : `POST /api/v1/performance/sync/amazon-ads`  
  - Optionnel : `feedId`, `region` (eu|na).  
  - Credentials : **PlatformConnection** `platform = 'amazon_ads'` (merchantid = profileId, refreshtoken, metadata.clientId / metadata.clientSecret) ou body `profileId`, `clientId`, `clientSecret`, `refreshToken`.  
  - Env : `AMAZON_ADS_CLIENT_ID`, `AMAZON_ADS_CLIENT_SECRET` (optionnel si en metadata/connexion).

- **Mapping** : `advertisedAsin` (rapport) = `FeedItem.sku` ou `FeedItem.originId` ou `FeedItem.customfields.asin`.

Voir **docs/PERFORMANCE_DATA_DEEP_DIVE.md** pour le design complet.
