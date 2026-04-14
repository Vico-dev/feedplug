CREATE TABLE IF NOT EXISTS shared_rate_limits (
  scope TEXT NOT NULL,
  ratelimitkey TEXT NOT NULL,
  hitcount INTEGER NOT NULL DEFAULT 0,
  resetat TIMESTAMPTZ NOT NULL,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, ratelimitkey)
);

CREATE INDEX IF NOT EXISTS idx_shared_rate_limits_resetat
ON shared_rate_limits(resetat);
