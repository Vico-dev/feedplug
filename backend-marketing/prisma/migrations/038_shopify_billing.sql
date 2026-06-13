-- Shopify Billing API support
-- Permet de facturer les merchants installés via Shopify App Store via leur
-- Shopify Billing (AppSubscriptionCreate) plutôt que Stripe. Les merchants
-- installés directement depuis feedplug.com restent sur Stripe.

-- 1. Routage de facturation au niveau Account
ALTER TABLE "Account"
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'STRIPE';

CREATE INDEX IF NOT EXISTS account_billing_provider_idx
ON "Account"(billing_provider);

-- 2. Suivi des abonnements Shopify
-- Une ligne par subscription Shopify (un account peut en avoir plusieurs au
-- cours du temps : annulée + nouvelle). La sub courante est celle avec
-- status='ACTIVE' la plus récente.
CREATE TABLE IF NOT EXISTS shopify_subscriptions (
  id                       TEXT PRIMARY KEY,
  accountid                TEXT NOT NULL,
  shop_domain              TEXT NOT NULL,
  shopify_subscription_id  TEXT NOT NULL,
  plan_key                 TEXT NOT NULL,
  price_amount             NUMERIC(12, 2) NOT NULL,
  currency                 TEXT NOT NULL,
  interval                 TEXT NOT NULL DEFAULT 'EVERY_30_DAYS',
  status                   TEXT NOT NULL DEFAULT 'PENDING',
  trial_days               INTEGER NOT NULL DEFAULT 0,
  trial_ends_at            TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  confirmation_url         TEXT,
  return_url               TEXT,
  test_mode                BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at             TIMESTAMPTZ,
  createdat                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopify_subscriptions_accountid_idx
ON shopify_subscriptions(accountid);

CREATE INDEX IF NOT EXISTS shopify_subscriptions_shop_idx
ON shopify_subscriptions(shop_domain);

CREATE INDEX IF NOT EXISTS shopify_subscriptions_status_idx
ON shopify_subscriptions(status);

CREATE UNIQUE INDEX IF NOT EXISTS shopify_subscriptions_shopify_id_uidx
ON shopify_subscriptions(shopify_subscription_id);
