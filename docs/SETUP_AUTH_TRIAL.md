# Configuration Auth + Trial + Onboarding + Stripe

## Variables d'environnement

### Backend (backend-marketing)

```env
# Google OAuth
GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com

# Stripe (Dashboard Stripe > Developers > API keys)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Price IDs des abonnements (Stripe Dashboard > Products)
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PROFESSIONAL=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx

# URL de l'app (pour redirects Stripe)
APP_URL=https://app.feedplug.com
```

### Frontend (frontend)

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
NEXT_PUBLIC_SITE_URL=https://app.feedplug.com
```

**Important (Connexion Google)** : pour que « Continuer avec Google » fonctionne en prod, l’origine `https://app.feedplug.com` doit être ajoutée dans la Google Cloud Console → Identifiants → votre client OAuth 2.0 (Web) → **Origines JavaScript autorisées**. Sinon : erreur « no registered origin » / 401 invalid_client. Voir [GOOGLE_OAUTH_ORIGINE.md](./GOOGLE_OAUTH_ORIGINE.md).

## Migrations base de données

```bash
cd backend-marketing
psql $DATABASE_URL -f prisma/migrations/016_account_trial.sql
psql $DATABASE_URL -f prisma/migrations/017_billing_onboarding.sql
```

## Webhook Stripe

1. Stripe Dashboard > Developers > Webhooks > Add endpoint
2. URL : `https://votre-backend.run.app/api/v1/billing/webhook`
3. Événements : `customer.subscription.created`, `customer.subscription.updated`
4. Copier le signing secret dans `STRIPE_WEBHOOK_SECRET`

## Flow implémenté

1. **Inscription** (email/mdp ou Google) → 30 jours d'essai gratuit, sans CB
2. **Onboarding** → Page de bienvenue (progression sauvegardée)
3. **Dashboard** → Accès complet pendant l'essai
4. **Fin d'essai** → Redirection vers `/choose-plan`
5. **/choose-plan** → 3 étapes : Choix plan → Formulaire B2B → Paiement Stripe
6. **Webhook Stripe** → Mise à jour `Account.plan` et `Billing.stripe_subscription_id`
