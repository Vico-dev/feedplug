# Configuration Shopify OAuth

Pour activer la connexion Shopify dans FeedPlug, il faut configurer les clés OAuth côté backend.

## 1. Créer une app Shopify

1. Créez un compte sur [partners.shopify.com](https://partners.shopify.com) si ce n’est pas déjà fait.
2. Choisissez la **méthode de distribution** :
   - **Recommandé pour FeedPlug : Public (non listée)**  
     Le bouton « Connecter Shopify » depuis l’app redirige directement vers l’écran d’autorisation. Vous gardez l’app non listée dans le App Store.
   - **Custom (distribution personnalisée)**  
     Avec Custom, Shopify n’accepte que le **lien d’installation généré dans Partners** (Distribution → Générer un lien). Si vous voyez « Le lien d’installation de cette appli n’est pas valide », c’est en général parce que l’app est en Custom alors que le flux part d’un lien construit par FeedPlug. **Solution :** passer l’app en **Public (non listée)** dans Partners, ou n’utiliser que le lien généré par Partners et définir l’**URL de l’app** sur notre endpoint d’installation (voir section 6).
3. Dans **Configuration** (App setup) → **URLs** → **URL de redirection autorisée(s)** (Allowed redirection URL(s)) :
   - Ajoute **exactement** cette URL (sans slash final) :
     ```
     https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/connectors/shopify/callback
     ```
   - Si tu vois « Oauth error invalid_request: The redirect_uri is not whitelisted », c’est que cette URL n’est pas (ou pas exactement) dans la liste des redirections autorisées de l’app Shopify.
4. Récupérez **Client ID** (API Key) et **Client Secret** (API Secret).
5. Vérifiez les paramètres d’app versionnés dans le repo :
   - `shopify.app.toml` utilise l’Admin API / webhook version `2026-04`
   - le scope demandé par défaut est volontairement minimal : `read_products`
   - la synchronisation catalogue est pilotée par les webhooks `products/create`, `products/update`, `products/delete`, avec relance manuelle possible depuis l’embedded app

## 2. Créer les secrets dans GCP Secret Manager

```bash
# API Key (Client ID)
echo -n "VOTRE_CLIENT_ID" | gcloud secrets create shopify-api-key \
  --data-file=- \
  --project=feedplug-prod

# API Secret (Client Secret)
echo -n "VOTRE_CLIENT_SECRET" | gcloud secrets create shopify-api-secret \
  --data-file=- \
  --project=feedplug-prod
```

Si les secrets existent déjà, mettez à jour les versions :

```bash
echo -n "VOTRE_CLIENT_ID" | gcloud secrets versions add shopify-api-key --data-file=- --project=feedplug-prod
echo -n "VOTRE_CLIENT_SECRET" | gcloud secrets versions add shopify-api-secret --data-file=- --project=feedplug-prod
```

## 3. Donner accès au service Cloud Run

Le compte de service Cloud Run doit pouvoir lire les secrets :

```bash
PROJECT_ID="feedplug-prod"
SERVICE_ACCOUNT=$(gcloud run services describe feedplug-backend-marketing \
  --region=europe-west1 \
  --project=$PROJECT_ID \
  --format='value(spec.template.spec.serviceAccountName)')

# Si le compte de service est vide, utilisez le compte par défaut
if [ -z "$SERVICE_ACCOUNT" ]; then
  SERVICE_ACCOUNT="${PROJECT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
fi

gcloud secrets add-iam-policy-binding shopify-api-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID

gcloud secrets add-iam-policy-binding shopify-api-secret \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

## 4. Attacher les secrets au service Cloud Run

Une fois les secrets créés, attachez-les au backend :

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --update-secrets=SHOPIFY_API_KEY=shopify-api-key:latest,SHOPIFY_API_SECRET=shopify-api-secret:latest
```

Le `cloudbuild-backend-marketing.yaml` inclut déjà ces secrets. **Créez-les dans Secret Manager avant de déployer**, sinon le déploiement échouera. Pour attacher les secrets sans redéployer tout le backend (après les avoir créés) :

```bash
gcloud run services update feedplug-backend-marketing \
  --region=europe-west1 \
  --project=feedplug-prod \
  --update-secrets=SHOPIFY_API_KEY=shopify-api-key:latest,SHOPIFY_API_SECRET=shopify-api-secret:latest
```

## 5. Vérifier

Après déploiement, testez la connexion Shopify depuis la page Sources. L’erreur « Clés Shopify non configurées » ne doit plus apparaître.

## 6. Erreur « Le lien d’installation de cette appli n’est pas valide »

Cette erreur apparaît quand l’app est en **distribution personnalisée (Custom)** et que le marchand n’utilise pas le lien d’installation généré par Shopify.

- **Option A (recommandée) :** Dans [Partners](https://partners.shopify.com) → votre app → **Distribution** → passer à **Public**, puis garder l’app **non listée** (unlisted). Ainsi le flux depuis FeedPlug (bouton « Connecter Shopify ») fonctionne sans changer de code.
- **Option B :** Rester en Custom et utiliser uniquement le lien généré dans Partners (Distribution → Générer un lien pour la boutique). Dans ce cas, définissez l’**URL de l’app** (App URL) dans la configuration de l’app sur :
  ```
  https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/connectors/shopify/install
  ```
  Quand le marchand ouvre le lien généré, il arrive sur ce endpoint, qui vérifie la requête et redirige vers l’écran d’autorisation. Après autorisation, la credential est créée mais pas encore liée à un compte. Le marchand doit se connecter à FeedPlug puis appeler **POST /api/v1/connectors/shopify/claim** avec `{ "shop": "boutique.myshopify.com" }` pour lier la boutique à son compte (ou utiliser l’écran Sources qui peut proposer cette liaison).
