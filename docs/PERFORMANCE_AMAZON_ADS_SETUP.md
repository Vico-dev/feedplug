# Configuration du sync Amazon Advertising (performances par ASIN)

Pour alimenter **PerformanceChannel** et **PerformanceChannelHistory** avec les métriques Amazon Advertising (Sponsored Products par ASIN), le sync utilise l’API Reporting v3 (rapport asynchrone).

## 1. Credentials

- **LWA** : client_id, client_secret, refresh_token (obtenus via le flux OAuth Amazon Advertising / Login with Amazon).
- **Profil** : profileId (Amazon-Advertising-API-Scope) = identifiant du compte publicitaire.

Variables d’environnement optionnelles : `AMAZON_ADS_CLIENT_ID`, `AMAZON_ADS_CLIENT_SECRET`.

## 2. Connexion par compte (optionnel)

**PlatformConnection** `platform = 'amazon_ads'` :

- **merchantid** : profileId (scope)
- **refreshtoken** : refresh token LWA
- **metadata** : `{ "clientId": "...", "clientSecret": "..." }` (si pas en env)

Ou envoyer dans le body : `profileId`, `clientId`, `clientSecret`, `refreshToken`.

## 3. Appel du sync

- **POST** `/api/v1/performance/sync/amazon-ads`  
  - Query/body : `feedId` (optionnel), `region` (optionnel, `eu` ou `na`).  
  - Réponse : `{ ok, synced, skipped, errors }`.

Le rapport est créé, puis pollé jusqu’à complétion (timeout ~2 min), téléchargé (GZIP), puis chaque ligne (ASIN) est mappée et écrite.

## 4. Mapping

**advertisedAsin** (colonne du rapport) est associé à :

- **FeedItem.sku**
- **FeedItem.originId**
- **FeedItem.id**
- **FeedItem.customfields.asin**

Les produits sans correspondance sont ignorés (skipped).

## 5. Région

- `region=eu` → `https://advertising-api-eu.amazon.com`
- `region=na` → `https://advertising-api.amazon.com`
