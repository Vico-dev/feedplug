# Configuration du sync Google Ads (performances par produit)

Pour alimenter **PerformanceChannel** et **PerformanceChannelHistory** avec les métriques Google Ads (Shopping), il faut configurer les credentials et éventuellement une connexion par compte.

## 1. Variables d’environnement (serveur)

À définir sur le backend-marketing (Cloud Run ou `.env`) :

| Variable | Description |
|----------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Token développeur Google Ads (Google Ads API Center). |
| `GOOGLE_ADS_CLIENT_ID` | Client ID OAuth (ou `GOOGLE_CLIENT_ID` si déjà utilisé pour GMC). |
| `GOOGLE_ADS_CLIENT_SECRET` | Client secret OAuth (ou `GOOGLE_CLIENT_SECRET`). |

Le scope OAuth pour Google Ads doit inclure l’accès à l’API Google Ads (ex. `https://www.googleapis.com/auth/adwords`). Ce n’est pas le même que le scope Content API (GMC). Une app peut avoir les deux scopes si l’utilisateur autorise les deux.

## 2. Connexion par compte (optionnel)

Pour ne pas passer les credentials à chaque appel, on peut enregistrer une **PlatformConnection** pour le compte :

- **platform** : `google_ads`
- **merchantid** : ID client Google Ads (sans tirets, ex. `1234567890`)
- **refreshtoken** : Refresh token OAuth (scope adwords)
- **accesstoken** : Optionnel ; peut être rafraîchi à partir du refresh token.

**Écran dans l’app** : sur la page **Performance** (`/performance`), une section « Connexion Google Ads » permet de :
- **Connecter Google Ads** : OAuth2 (scope adwords) → redirection vers Google, puis callback qui enregistre la connexion (`PlatformConnection` `platform = 'google_ads'`).
- **Synchroniser les données** : appelle `POST /api/v1/performance/sync/google-ads`.
- **Déconnecter** : supprime la connexion.

L’URI de redirection OAuth doit être enregistrée dans la console Google (Cloud ou API Center) :  
`https://<backend-url>/api/v1/platforms/google-ads/callback`  
(variable optionnelle : `GOOGLE_ADS_REDIRECT_URI` sur le backend).

En secours, on peut encore insérer la connexion en base pour un compte donné, ou appeler le sync en envoyant **customerId** et **refreshToken** dans le body du `POST /api/v1/performance/sync/google-ads`.

## 3. Appel du sync

- **POST** `/api/v1/performance/sync/google-ads`  
  - Authentification : token JWT (requireAuth).  
  - Query ou body : `feedId` (optionnel) pour limiter aux produits d’un feed.  
  - Si aucune PlatformConnection `google_ads` : envoyer dans le body `customerId` et `refreshToken`.

Réponse : `{ ok, synced, skipped, errors }`.

## 4. Mapping produit

Les lignes Google Ads (shopping_performance_view) sont identifiées par **product_item_id**. On fait la correspondance avec :

- **FeedItem.originId** ou **FeedItem.id** (identique à l’`offerId` envoyé au Merchant Center lors du push GMC).

Seuls les produits dont le feed appartient au compte connecté sont pris en compte. Les produits sans correspondance sont comptés en `skipped`.

## 5. Planification (cron)

Pour un sync régulier (ex. quotidien), appeler **POST** `/api/v1/performance/sync/google-ads` via un job planifié (Cloud Scheduler, cron, etc.) en passant le JWT du compte ou en stockant une connexion `google_ads` par compte et en déclenchant le sync par compte.

La purge de l’historique (90 jours) se fait via **POST** `/api/v1/admin/performance/purge` (staff ou CRON_SECRET).
