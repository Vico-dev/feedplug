# Configuration du connecteur Amazon

## Variables d'environnement

```env
# Obligatoires pour toute connexion (OAuth ou manuelle)
AMAZON_LWA_CLIENT_ID=amzn1.application-oa2-client.xxx
AMAZON_LWA_CLIENT_SECRET=xxx

# Pour OAuth (connexion via redirect)
AMAZON_APPLICATION_ID=amzn1.sellerapps.app.xxx
AMAZON_REDIRECT_URI=https://api.feedplug.com/api/v1/platforms/amazon/callback
AMAZON_LOGIN_URI=https://api.feedplug.com/api/v1/platforms/amazon/login
AMAZON_SELLER_CENTRAL_BASE=https://sellercentral.amazon.fr
APP_URL=https://app.feedplug.com

# Optionnel (défaut: EU)
AMAZON_SP_API_BASE=https://sellingpartnerapi-eu.amazon.com
```

## Connexion OAuth (recommandée)

1. Enregistrer une application **public** dans [Seller Central > Apps & Services > Develop Apps](https://sellercentral.amazon.fr/sellingpartner/developerconsole)
2. Configurer :
   - **Log-in URI** : `https://VOTRE_API/api/v1/platforms/amazon/login`
   - **Redirect URI** : `https://VOTRE_API/api/v1/platforms/amazon/callback`
3. Renseigner les variables d'environnement ci-dessus
4. Les vendeurs cliquent « Connecter Amazon » dans FeedPlug et autorisent l'app

## Connexion manuelle (app privée / tests)

Pour une app **privée** (auto-autorisation) :

1. Dans Seller Central, autorisez votre app et récupérez le **refresh token**
2. Appelez `POST /api/v1/platforms/amazon/connect` avec :
   ```json
   { "refresh_token": "Atzr|...", "seller_id": "A1XXXXX..." }
   ```
3. Le `seller_id` est l’identifiant vendeur (optionnel si déjà connu)

## Push produits

- `POST /api/v1/platforms/amazon/push/:feedId?channel=amazon_fr`
- Canaux : `amazon_fr`, `amazon_uk`, `amazon_de`, `amazon_it`, `amazon_es`
- Utilise la Listings Items API (putListingsItem)
