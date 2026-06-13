-- Suivi de la consommation IA par compte et par mois (soft cap).
-- On compte les optimisations IA ; on n'enforce pas de blocage — on alerte
-- l'équipe à 80 % et 100 % du plafond de référence.
CREATE TABLE IF NOT EXISTS ai_usage (
  accountid  TEXT NOT NULL,
  period     TEXT NOT NULL,            -- 'YYYY-MM' (UTC)
  count      INTEGER NOT NULL DEFAULT 0,
  alerted80  BOOLEAN NOT NULL DEFAULT false,
  alerted100 BOOLEAN NOT NULL DEFAULT false,
  updatedat  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (accountid, period)
);
