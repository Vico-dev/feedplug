-- Shopify mandatory compliance webhooks (App Store requirement).
-- Stocke chaque requête GDPR/compliance reçue pour traçabilité et traitement asynchrone.
-- Topics : customers/data_request, customers/redact, shop/redact, app/uninstalled.

CREATE TABLE IF NOT EXISTS shopify_compliance_requests (
  id              TEXT PRIMARY KEY,
  topic           TEXT NOT NULL,
  shop_domain     TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'received',
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  createdat       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopify_compliance_requests_topic_idx
ON shopify_compliance_requests(topic);

CREATE INDEX IF NOT EXISTS shopify_compliance_requests_shop_idx
ON shopify_compliance_requests(shop_domain);

CREATE INDEX IF NOT EXISTS shopify_compliance_requests_status_idx
ON shopify_compliance_requests(status);

CREATE INDEX IF NOT EXISTS shopify_compliance_requests_createdat_idx
ON shopify_compliance_requests(createdat);
