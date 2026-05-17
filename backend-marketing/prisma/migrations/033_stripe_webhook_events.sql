-- Idempotence des webhooks Stripe : trace les events déjà traités pour éviter
-- les double-traitements lors des redéliveries (retry / timeout) de Stripe.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  processedat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_processedat_idx
ON stripe_webhook_events(processedat);
