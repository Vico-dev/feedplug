# Déploiement avec Stripe

## 1. Créer les secrets Stripe dans GCP (une seule fois)

Depuis la racine du projet, avec ton `.env` configuré :

```bash
./scripts/setup-stripe-secrets.sh
```

Ou manuellement :

```bash
# Définir le projet GCP
gcloud config set project TON_PROJECT_ID

# Créer le secret STRIPE_SECRET_KEY
echo -n "sk_test_xxx" | gcloud secrets create stripe-secret-key --data-file=-

# Créer le secret STRIPE_WEBHOOK_SECRET  
echo -n "whsec_xxx" | gcloud secrets create stripe-webhook-secret --data-file=-
```

## 2. Migration base de données (production)

Si pas déjà fait :

```bash
psql $DATABASE_URL -f backend-marketing/prisma/migrations/016_account_trial.sql
psql $DATABASE_URL -f backend-marketing/prisma/migrations/017_billing_onboarding.sql
```

## 3. Mettre à jour le webhook Stripe (action manuelle)

**Dashboard Stripe** → [Développeurs → Webhooks](https://dashboard.stripe.com/webhooks) → Add endpoint (ou modifier l’existant) :

| Champ | Valeur |
|-------|--------|
| **URL** | `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/billing/webhook` |
| **Événements** | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` |

Après création, récupère le **Signing secret** (whsec_xxx) et mets à jour le secret GCP :

```bash
echo -n "whsec_XXX" | gcloud secrets versions add stripe-webhook-secret --data-file=- --project=feedplug-prod
```

## 4. Déployer

### Option A : Google Cloud Build (recommandé)

```bash
gcloud builds submit --config=cloudbuild-backend-marketing.yaml .
```

### Option B : Déploiement manuel

```bash
cd backend-marketing
docker build -t gcr.io/TON_PROJECT_ID/feedplug-backend-marketing:latest .
docker push gcr.io/TON_PROJECT_ID/feedplug-backend-marketing:latest

gcloud run deploy feedplug-backend-marketing \
  --image gcr.io/TON_PROJECT_ID/feedplug-backend-marketing:latest \
  --region europe-west1 \
  --platform managed
```

## Modifications apportées pour ce déploiement

- **Dockerfile** : ajout de `COPY routes ./routes/` (onboarding + billing)
- **cloudbuild** : secrets Stripe + variables APP_URL, STRIPE_PRICE_*
- **scripts/setup-stripe-secrets.sh** : script de création des secrets GCP
