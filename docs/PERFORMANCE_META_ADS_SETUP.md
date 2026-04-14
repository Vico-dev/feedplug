# Configuration du sync Meta Ads (performances par produit)

Pour alimenter **PerformanceChannel** et **PerformanceChannelHistory** avec les métriques Meta Ads (breakdown par product_id), il faut une connexion Meta avec un token d’accès et l’ID du compte publicitaire.

## 1. Connexion par compte

Enregistrer une **PlatformConnection** pour le compte :

- **platform** : `meta`
- **merchantid** : ID du compte publicitaire (ex. `act_123456789` ou `123456789`)
- **accesstoken** : Token d’accès Meta avec les permissions nécessaires (`ads_read`, accès au catalogue si besoin)

Ou envoyer **adAccountId** et **accessToken** dans le body de `POST /api/v1/performance/sync/meta-ads`.

## 2. Appel du sync

- **POST** `/api/v1/performance/sync/meta-ads`  
  - Authentification : token JWT (requireAuth).  
  - Query ou body : `feedId` (optionnel).  
  - Si aucune PlatformConnection `meta` : envoyer dans le body `adAccountId` et `accessToken`.

Réponse : `{ ok, synced, skipped, errors }`.

## 3. Mapping produit

Les lignes Meta (insights avec `breakdowns=product_id`) sont identifiées par **product_id** (ID produit dans le catalogue Meta). On fait la correspondance avec :

- **FeedItem.id**
- **FeedItem.customfields.metaProductId** (si renseigné après un push catalogue)
- **FeedItem.originId**

Les produits sans correspondance sont ignorés (skipped).

## 4. Limites Meta

Avec le breakdown `product_id`, les métriques off-Meta (conversions site web) peuvent ne pas être renvoyées (Type 2 breakdown). Les métriques on-Meta (impressions, clics, spend) sont disponibles.
