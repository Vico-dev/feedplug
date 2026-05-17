-- Centre de notifications in-app : alerte le client sur les événements
-- importants (échec d'import/export planifié, etc.).
CREATE TABLE IF NOT EXISTS notification (
  id        TEXT PRIMARY KEY,
  accountid TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'info',     -- success | error | warning | info | ab_test | performance
  priority  TEXT NOT NULL DEFAULT 'medium',   -- urgent | high | medium | low
  title     TEXT NOT NULL,
  message   TEXT NOT NULL DEFAULT '',
  actionurl TEXT,
  read      BOOLEAN NOT NULL DEFAULT false,
  createdat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_account_idx ON notification(accountid, createdat DESC);
CREATE INDEX IF NOT EXISTS notification_unread_idx ON notification(accountid, read);
