-- Ledger cashback : une ligne par conversion AWIN rapprochée d'un utilisateur via clickref.
-- Idempotent sur awintransactionid (le poll/webhook est rejouable sans double-crédit).
CREATE TABLE IF NOT EXISTS "CashbackTransaction" (
  id                text PRIMARY KEY,
  userid            text NOT NULL,
  clickeventid      text,
  awintransactionid text NOT NULL,
  advertiserid      text,
  merchantname      text,
  saleamount        double precision,
  commissionamount  double precision,
  cashbackamount    double precision,                 -- part reversée à l'utilisateur
  currency          text,
  status            text NOT NULL DEFAULT 'pending',   -- pending|validated|payable|paid|rejected
  awinstatus        text,                              -- statut AWIN brut (pending/approved/declined)
  clickref          text,
  occurredat        timestamptz,                       -- date de la transaction
  validatedat       timestamptz,
  createdat         timestamptz NOT NULL DEFAULT now(),
  updatedat         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashbacktx_awinid ON "CashbackTransaction" (awintransactionid);
CREATE INDEX IF NOT EXISTS idx_cashbacktx_userid ON "CashbackTransaction" (userid);
CREATE INDEX IF NOT EXISTS idx_cashbacktx_status ON "CashbackTransaction" (status);
