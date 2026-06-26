# Activation Amazon Seller Central (LWA + SP-API)

Runbook pour passer la connexion Amazon de **« arrive bientôt »** à **active** en production.

Tant que `AMAZON_APPLICATION_ID` est vide, `GET /api/v1/platforms/amazon/connect-init`
renvoie `200 { configured: false }` et les deux UIs (dashboard `/channels` et app
Shopify embarquée `/embedded/channels`) affichent un message neutre « La connexion
Amazon Seller Central arrive bientôt sur FeedPlug. ». Aucune erreur 5xx n'est générée.

Le code (OAuth LWA, refresh token, push SP-API Listings, CRUD des marketplaces) est
**déjà en place** dans `backend-marketing/server-minimal.js`. Il ne manque que les
**credentials** et leur **câblage**.

> Note technique : le SP-API **ne requiert plus** la signature AWS SigV4 (supprimée par
> Amazon en 2023). Le token LWA (`x-amz-access-token`) seul suffit pour l'API Listings.
> Aucune credential AWS / IAM n'est nécessaire ici.

---

## Pré-requis

- Un compte **Amazon Seller Central** (vendeur) sur au moins un marketplace EU
  (FR/UK/DE/IT/ES — voir `AMAZON_CHANNEL_CONFIG` dans `server-minimal.js`).
- L'accès au **Solutions Provider Portal** (developer.amazonservices.com) pour
  enregistrer l'application SP-API et obtenir l'`Application ID` + le client LWA.
  L'inscription développeur SP-API peut nécessiter une validation Amazon (quelques jours).
- Accès **GCP** au projet `feedplug-prod` (Secret Manager + Cloud Run).

---

## Étape 1 — Enregistrer l'application SP-API

1. Aller dans **Seller Central → Apps & Services → Develop Apps** (Solution Provider Portal).
2. **Add new app client** → application de type **SP-API**.
3. Renseigner :
   - **App name** : `FeedPlug`
   - **OAuth Login URI** : `https://app.feedplug.com/embedded/channels`
     (page de retour ; sert d'affichage du consentement)
   - **OAuth Redirect URI** :
     `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/platforms/amazon/callback`
     ⚠️ Doit correspondre **exactement** à `AMAZON_REDIRECT_URI` (déjà câblé dans
     `cloudbuild-backend-marketing.yaml`).
   - **Roles / data** : sélectionner au minimum le rôle **Product Listing** (Listings Items API).
     Ne PAS demander de rôles PII (commandes/buyer info) : inutile pour le push catalogue
     et cela imposerait des Restricted Data Tokens.
4. Récupérer :
   - **Application ID** (`amzn1.sp.solution.xxxx`) → `AMAZON_APPLICATION_ID`
   - **LWA credentials** : **Client ID** (`amzn1.application-oa2-client.xxxx`) → `AMAZON_LWA_CLIENT_ID`
     et **Client Secret** → `AMAZON_LWA_CLIENT_SECRET`

---

## Étape 2 — Créer les secrets GCP

```bash
PROJECT=feedplug-prod

printf '%s' 'amzn1.application-oa2-client.XXXX' | \
  gcloud secrets create amazon-lwa-client-id --project="$PROJECT" --data-file=-
printf '%s' 'LE_CLIENT_SECRET_LWA' | \
  gcloud secrets create amazon-lwa-client-secret --project="$PROJECT" --data-file=-
printf '%s' 'amzn1.sp.solution.XXXX' | \
  gcloud secrets create amazon-application-id --project="$PROJECT" --data-file=-
```

Donner au service account Cloud Run l'accès en lecture (si pas déjà couvert par un rôle large) :

```bash
SA="$(gcloud run services describe feedplug-backend-marketing --region=europe-west1 \
  --project="$PROJECT" --format='value(spec.template.spec.serviceAccountName)')"
for s in amazon-lwa-client-id amazon-lwa-client-secret amazon-application-id; do
  gcloud secrets add-iam-policy-binding "$s" --project="$PROJECT" \
    --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
done
```

> Mettre à jour une valeur plus tard : `gcloud secrets versions add <nom> --data-file=-`.

---

## Étape 3 — Câbler les secrets dans le déploiement

Dans `cloudbuild-backend-marketing.yaml`, **décommenter** (suivre le commentaire
« Activation Amazon SP-API ») en ajoutant à la fin de la valeur `--update-secrets` :

```
,AMAZON_LWA_CLIENT_ID=amazon-lwa-client-id:latest,AMAZON_LWA_CLIENT_SECRET=amazon-lwa-client-secret:latest,AMAZON_APPLICATION_ID=amazon-application-id:latest
```

`AMAZON_REDIRECT_URI` est déjà présent dans `--set-env-vars` (pas un secret).
`AMAZON_SELLER_CENTRAL_BASE` / `AMAZON_SP_API_BASE` gardent leurs défauts EU
(`https://sellercentral.amazon.fr` / `https://sellingpartnerapi-eu.amazon.com`).

> ⚠️ Ne décommenter qu'**après** l'étape 2 : `gcloud` échoue si un secret référencé
> n'existe pas, ce qui ferait planter tout le déploiement.

---

## Étape 4 — Redéployer

```bash
gcloud builds submit --config=cloudbuild-backend-marketing.yaml --project=feedplug-prod
```

Vérifier que les variables sont bien injectées :

```bash
gcloud run services describe feedplug-backend-marketing --region=europe-west1 \
  --project=feedplug-prod \
  --format='yaml(spec.template.spec.containers[0].env)' | grep -i amazon
```

---

## Étape 5 — QA manuelle (compte test)

1. **connect-init** : appeler `GET /api/v1/platforms/amazon/connect-init` (authentifié) →
   doit désormais renvoyer `{ connectUrl, configured: true }` (et non plus `configured:false`).
2. **Dashboard** : ouvrir `https://app.feedplug.com/fr/channels` → carte **Amazon Seller
   Central** → **Connecter Amazon**. On est redirigé vers Seller Central → consentir.
   Au retour : badge « Connecté » + Seller ID renseigné, toast de succès.
3. **App embarquée** : même test depuis `/embedded/channels` dans l'admin Shopify.
4. **Activer un marketplace** : cliquer **Activer** sur Amazon FR → la carte « Marketplaces
   actives » passe à 1.
5. **Push d'un flux** : depuis la page **Flux**, pousser un flux vers un canal Amazon →
   vérifier le résultat (`succeeded`/`failed`) puis contrôler dans
   **Seller Central → Inventaire → Gérer les stocks** que les produits apparaissent.
6. **Refresh token** : attendre l'expiration de l'access token (≈ 1 h) ou forcer un push
   plus tard → le refresh doit être transparent (pas de reconnexion demandée). En cas de
   `reconnect: true`, le refresh_token a été révoqué → reconnecter.

### Checklist de vérification

- [ ] `connect-init` renvoie `configured:true`
- [ ] OAuth aller-retour OK (dashboard **et** embarqué), Seller ID stocké
- [ ] Activation/désactivation d'un marketplace fonctionne
- [ ] Push d'un flux : produits visibles dans Seller Central
- [ ] Refresh d'access token transparent après expiration
- [ ] Déconnexion → reconnexion OK

---

## Dépannage

| Symptôme (query param de retour) | Cause probable | Action |
|---|---|---|
| `?amazon=error&reason=config` | un des `AMAZON_LWA_CLIENT_ID/SECRET` ou `AMAZON_REDIRECT_URI` vide | vérifier les secrets/env injectés (étape 4) |
| `?amazon=error&reason=token_exchange` | Redirect URI non identique à celle enregistrée, ou client invalide | aligner l'OAuth Redirect URI Seller Central avec `AMAZON_REDIRECT_URI` |
| Push → `reconnect:true` (401/403) | access token invalide / refresh révoqué | reconnecter Seller Central depuis `/channels` |
| Push → message « throttling Amazon détecté » (429) | rate limit SP-API | réessayer après quelques minutes |

Logs utiles (Cloud Logging) : rechercher `Amazon token exchange HTTP error`,
`Amazon refresh token HTTP error`, `Amazon callback error`.
