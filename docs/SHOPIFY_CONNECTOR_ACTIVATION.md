# Activation de l'app connecteur Shopify (app B, unlisted)

> Runbook d'activation de la 2e app Shopify (le **connecteur** unlisted/gratuit) pour
> les marchands venus de feedplug.com qui paient via **Stripe**. L'app **listée**
> (App Store, Managed Pricing) n'est PAS concernée : elle reste inchangée.
>
> Le code est déjà déployable (branche `feat/shopify-multi-app`, commit `a5a2b66`).
> Tant que les variables `SHOPIFY_CONNECTOR_*` ne sont pas posées en prod, le
> connecteur est **désactivé** (l'app listée tourne normalement). Ce runbook pose
> ces variables et active l'app B.

## Constantes utiles

| | Valeur |
|---|---|
| Projet GCP | `feedplug-prod` |
| Backend (Cloud Run) | `https://feedplug-backend-marketing-771607738477.europe-west1.run.app` |
| Callback OAuth | `…/api/v1/connectors/shopify/callback` |
| Webhook connecteur | `…/api/v1/webhooks/shopify/connector` |
| Scopes | `read_products` |
| Secrets à créer | `shopify-connector-api-key`, `shopify-connector-api-secret` |
| Config CLI | `shopify.app.connector.toml` |

---

## Étape 1 — Créer l'app B dans Shopify Partners (toi)

Dans [Shopify Partners](https://partners.shopify.com) → **Apps** → **Create app** → **Create app manually**.

- **Nom** : `FeedPlug Connector`
- **App URL** : `https://app.feedplug.com`
- **Allowed redirection URL(s)** :
  `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/connectors/shopify/callback`
  ⚠️ **Doit être exactement cette URL** (voir le piège §6). Pas `api.feedplug.com`.
- **Embedded** : **NON** (décoché). C'est une app non-embedded.
- **Distribution** : **Custom / unlisted** (PAS App Store). Pas de Managed Pricing.
- **Scopes** : `read_products`.
- **Webhooks (version 2026-04)** — pointer vers le chemin `/connector` :
  - `app/uninstalled` → `…/api/v1/webhooks/shopify/connector`
  - `products/create`, `products/update`, `products/delete` → `…/api/v1/webhooks/shopify/connector`
  - **Compliance/GDPR (obligatoires)** : `customers/data_request`, `customers/redact`, `shop/redact` → `…/api/v1/webhooks/shopify/connector`

Puis récupère dans la fiche de l'app : **Client ID** (= API key) et **Client secret**.

---

## Étape 2 — Créer les secrets GCP (moi, dès que tu as Client ID + secret)

```bash
# Client ID (API key)
printf '%s' '<CLIENT_ID>' | gcloud secrets create shopify-connector-api-key \
  --data-file=- --project=feedplug-prod
# Client secret
printf '%s' '<CLIENT_SECRET>' | gcloud secrets create shopify-connector-api-secret \
  --data-file=- --project=feedplug-prod
```

(Si les secrets existent déjà : `gcloud secrets versions add <nom> --data-file=- --project=feedplug-prod`.)

---

## Étape 3 — Mettre le client_id dans le toml (moi)

Dans `shopify.app.connector.toml`, remplacer `PLACEHOLDER_CONNECTOR_CLIENT_ID` par le vrai Client ID.

---

## Étape 4 — Activer les variables dans le cloudbuild (moi)

Dans `cloudbuild-backend-marketing.yaml`, décommenter le bloc connecteur (déjà préparé) :

- Ajouter à la fin de `--set-env-vars` :
  `,SHOPIFY_CONNECTOR_CALLBACK_URL=https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/connectors/shopify/callback,SHOPIFY_CONNECTOR_SCOPES=read_products`
- Ajouter à la fin de `--update-secrets` :
  `,SHOPIFY_CONNECTOR_API_KEY=shopify-connector-api-key:latest,SHOPIFY_CONNECTOR_API_SECRET=shopify-connector-api-secret:latest`

⚠️ **Ordre impératif** : ne faire cette étape qu'**après** l'étape 2 (secrets créés). gcloud échoue si un secret référencé n'existe pas → casse tout le déploiement.

---

## Étape 5 — Déployer (toi ou moi)

```bash
./deploy-backend-marketing.sh
# (puis déployer le toml connecteur côté Shopify)
shopify app deploy --config connector
```

---

## Étape 6 — ⚠️ Piège redirect_uri (finding #4 de la revue)

Le code construit la `redirect_uri` du connecteur depuis `SHOPIFY_CONNECTOR_CALLBACK_URL`
(défaut → `SHOPIFY_CALLBACK_URL` → `api.feedplug.com`). Shopify **rejette** l'OAuth si
cette URL n'est pas dans les *Allowed redirection URLs* de l'app B.

➡️ Garde l'**URL Cloud Run** identique partout : Partners (étape 1), `SHOPIFY_CONNECTOR_CALLBACK_URL`
(étape 4), et le toml. Ne mélange pas `api.feedplug.com` et `*.run.app`.

---

## Étape 7 — Vérification post-déploiement

1. **Logs de boot** doivent afficher :
   `✅ App connecteur Shopify activée (webhook /api/v1/webhooks/shopify/connector monté).`
   (Si `⚠️ App connecteur Shopify DÉSACTIVÉE` → une seule des 2 clés est posée.)
   ```bash
   gcloud logging read 'resource.labels.service_name="feedplug-backend-marketing" AND textPayload:"connecteur Shopify"' \
     --project=feedplug-prod --limit=5 --freshness=10m
   ```
2. **`/connect`** depuis le dashboard feedplug.com → écran d'autorisation de **FeedPlug Connector** (pas l'app listée) → retour sur **feedplug.com** (PAS dans l'admin Shopify).
3. **Webhook** : un `products/update` doit être accepté (200) sur `/connector` et rejeté (401) s'il est signé avec le secret de l'app listée.
4. **Billing** : le compte du marchand reste `billing_provider = STRIPE` (pas de bascule SHOPIFY).
5. **Isolation** (si tu testes une boutique ayant les 2 apps) : un `shop/redact` connecteur ne supprime QUE les données taguées `connector`.

---

## Rappel : ce que le code garantit déjà

- Connecteur **optionnel** : sans les 2 env, app listée 100 % inchangée, `/connect` & audit-connect renvoient 503.
- **Isolation par `appId`** sur uninstall, `shop/redact` et catalog sync (credentials taggés `appId` dans `secretjson`).
- Tests : suite complète verte (242+1+1). Voir [[feedplug-shopify-billing-architecture]] côté mémoire.
