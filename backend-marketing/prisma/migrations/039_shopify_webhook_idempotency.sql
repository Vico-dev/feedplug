-- Idempotency pour les webhooks Shopify : Shopify rejoue les webhooks en cas
-- de timeout/5xx (jusqu'à 19 tentatives sur 48h). Sans dedup, app_subscriptions/update
-- peut UPDATE Account plusieurs fois, customers/redact peut tenter de re-supprimer, etc.
--
-- Stratégie : à chaque webhook reçu, on tente un INSERT ON CONFLICT DO NOTHING sur
-- l'id du webhook (header X-Shopify-Webhook-Id). Si l'INSERT renvoie 1 ligne, on
-- traite. Sinon (conflit) on répond 200 immédiatement sans re-traiter.

CREATE TABLE IF NOT EXISTS shopify_processed_webhooks (
  webhook_id   TEXT PRIMARY KEY,
  topic        TEXT NOT NULL,
  shop_domain  TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index sur processed_at pour purger les entrées anciennes (cron mensuel).
CREATE INDEX IF NOT EXISTS shopify_processed_webhooks_processed_at_idx
  ON shopify_processed_webhooks(processed_at);
