CREATE TABLE IF NOT EXISTS oauth_ephemeral_state (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  flow TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expiresat TIMESTAMPTZ NOT NULL,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_ephemeral_state_provider_idx
ON oauth_ephemeral_state(provider);

CREATE INDEX IF NOT EXISTS oauth_ephemeral_state_flow_idx
ON oauth_ephemeral_state(flow);

CREATE INDEX IF NOT EXISTS oauth_ephemeral_state_expiresat_idx
ON oauth_ephemeral_state(expiresat);
