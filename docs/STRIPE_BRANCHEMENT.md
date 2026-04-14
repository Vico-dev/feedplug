# Branchement Stripe — état des lieux et mise en place

## Configurateur (grille Produits × Canaux + Pack IA)

La page **Choisir un plan** (`/choose-plan`) et le **site public** (`/tarifs`) utilisent la **même grille** : l’utilisateur choisit une tranche de produits (100 à 50 000), un nombre de canaux (1 à 5) et optionnellement le Pack IA (+49 €). Le montant est calculé côté backend et envoyé à Stripe en **prix dynamique** (pas besoin de créer des dizaines de price IDs Stripe). Le webhook enregistre le plan sous la forme `TIER_1000` et l’option `addonIA` sur le compte.

---

## Ce qui existe déjà dans le code

| Élément | Où | Statut |
|--------|-----|--------|
| **Redirection après essai** | `[locale]/(dashboard)/layout.tsx` | Si `trialEndsAt` est dépassé → redirection vers `/choose-plan` |
| **Page « Choisir un plan »** | `app/choose-plan/page.tsx` | 3 étapes : choix du plan → infos facturation (Billing) → redirection Stripe Checkout |
| **API création session Stripe** | `backend-marketing/routes/onboarding-billing.js` | `POST /api/v1/billing/create-checkout-session` (plan, successUrl, cancelUrl) |
| **Webhook Stripe** | `onboarding-billing.js` | `POST /api/v1/billing/webhook` → met à jour `Account.plan`, `Account.addonia`, `Account.max_channels` et `Billing.stripe_subscription_id` à la souscription |
| **Table Billing** | Migration 017 | Infos facturation B2B (obligatoire avant checkout) |
| **Secrets GCP** | Cloud Build | `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` injectés via Secret Manager |

En résumé : **le flux (trial → choose-plan → Stripe → webhook) est codé**. Ce qui manque pour que ça fonctionne en prod, c’est la **configuration Stripe + les variables d’environnement**.

---

## Ce qui manque pour avoir un vrai paywall

### 1. Compte et produits Stripe

1. Aller sur [dashboard.stripe.com](https://dashboard.stripe.com) (compte test puis compte live).
2. **Produits** : créer 3 produits récurrents, par exemple :
   - **Starter** — 49 €/mois (ou le prix de ta grille)
   - **Professional** — 149 €/mois
   - **Enterprise** — 399 €/mois
3. Pour chaque produit, créer un **prix** (récurrent mensuel) et noter l’ID du prix (`price_xxxxx`).

### 2. Variables d’environnement (Price IDs)

Le backend attend ces variables (déjà utilisées dans `cloudbuild-backend-marketing.yaml`) :

| Variable | Rôle | Exemple |
|----------|------|--------|
| `STRIPE_PRICE_STARTER` | ID du prix Stripe Starter | `price_xxxxx` |
| `STRIPE_PRICE_PROFESSIONAL` | ID du prix Professional | `price_1T161cQ8WO9CgnnOY6LOv3Va` (déjà présent en prod) |
| `STRIPE_PRICE_ENTERPRISE` | ID du prix Enterprise | `price_xxxxx` |

**À faire** : dans `cloudbuild-backend-marketing.yaml`, dans `--set-env-vars`, remplacer les valeurs vides par les vrais `price_xxx` pour Starter et Enterprise (Professional est déjà renseigné).

### 3. Clés Stripe (Secret Manager)

- **STRIPE_SECRET_KEY** : clé secrète API Stripe (`sk_live_xxx` en prod, `sk_test_xxx` en test).
- **STRIPE_WEBHOOK_SECRET** : signing secret du webhook Stripe (`whsec_xxx`).

Création / mise à jour des secrets GCP (une fois) :

```bash
# Depuis la racine du projet, avec .env contenant STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET
./scripts/setup-stripe-secrets.sh
```

Ou à la main :

```bash
gcloud config set project feedplug-prod
echo -n "sk_live_xxx" | gcloud secrets create stripe-secret-key --data-file=- --project=feedplug-prod
# ou pour mettre à jour :
echo -n "sk_live_xxx" | gcloud secrets versions add stripe-secret-key --data-file=- --project=feedplug-prod

echo -n "whsec_xxx" | gcloud secrets create stripe-webhook-secret --data-file=- --project=feedplug-prod
# ou pour mettre à jour :
echo -n "whsec_xxx" | gcloud secrets versions add stripe-webhook-secret --data-file=- --project=feedplug-prod
```

### 4. Webhook Stripe (Dashboard)

1. [Stripe → Developers → Webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. **URL** : `https://feedplug-backend-marketing-771607738477.europe-west1.run.app/api/v1/billing/webhook`
3. **Événements** : cocher au minimum  
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Après création, récupérer le **Signing secret** (`whsec_xxx`) et le mettre dans le secret GCP `stripe-webhook-secret` (voir ci‑dessus).

### 5. Vérifier que le backend reçoit les secrets

Lors du déploiement (Cloud Build), les options `--update-secrets` doivent inclure :

- `STRIPE_SECRET_KEY=stripe-secret-key:latest`
- `STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest`

C’est déjà le cas dans ton `cloudbuild-backend-marketing.yaml`.

---

## Récap : checklist « Stripe opérationnel »

- [ ] Compte Stripe (test puis live) avec 3 produits récurrents créés
- [ ] Noter les 3 `price_xxx` (Starter, Professional, Enterprise)
- [ ] Mettre à jour `cloudbuild-backend-marketing.yaml` : `STRIPE_PRICE_STARTER=price_xxx`, `STRIPE_PRICE_ENTERPRISE=price_xxx` (Professional déjà fait)
- [ ] Créer / mettre à jour les secrets GCP : `stripe-secret-key`, `stripe-webhook-secret` (via `./scripts/setup-stripe-secrets.sh` ou commandes manuelles)
- [ ] Créer l’endpoint webhook dans le Dashboard Stripe avec l’URL du backend et les bons événements
- [ ] Mettre le Signing secret du webhook dans le secret GCP `stripe-webhook-secret`
- [ ] Redéployer le backend : `./deploy-backend-marketing.sh` (ou Cloud Build)
- [ ] Tester : compte en fin d’essai → redirection `/choose-plan` → choix du plan → infos facturation → « Payer avec Stripe » → paiement test → retour dashboard et vérifier que le compte a bien un plan mis à jour (webhook)

---

## Flux actuel (résumé)

1. **Inscription** → compte créé avec `trialEndsAt` = J+30 (géré côté backend à l’inscription).
2. **Pendant l’essai** → accès normal au dashboard (pas de blocage).
3. **Après expiration de l’essai** → à chaque chargement du layout dashboard, si `trialEndsAt < now` → `router.push('/choose-plan')` → **paywall** = on ne peut plus utiliser l’app sans aller sur choose-plan.
4. **Sur choose-plan** → l’utilisateur choisit un plan, remplit les infos Billing (table `Billing`), puis est redirigé vers Stripe Checkout.
5. **Après paiement** → Stripe envoie les événements au webhook → le backend met à jour `Account.plan` et `trialEndsAt = NULL` (ou équivalent) → l’utilisateur n’est plus redirigé vers choose-plan.

Il n’y a pas aujourd’hui de blocage « à la carte » (ex. limiter le nombre de sources selon le plan) : le seul blocage est **essai expiré → choose-plan**. - **Limite canaux** : `Account.max_channels` (1–5 depuis configurateur, ou valeur / NULL pour devis). Plus de 5 canaux = sur devis ; un admin met à jour `max_channels` manuellement. Les limites canaux sont appliquées à la création d'un canal (backend).
