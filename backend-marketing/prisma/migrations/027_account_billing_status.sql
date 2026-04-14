ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS billingstatus TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS paymentgraceuntil TIMESTAMPTZ;

COMMENT ON COLUMN "Account".billingstatus IS 'Etat de facturation du compte: pending, active, payment_failed.';
COMMENT ON COLUMN "Account".paymentgraceuntil IS 'Date limite de grâce avant blocage si un paiement différé Stripe n est pas confirmé.';
