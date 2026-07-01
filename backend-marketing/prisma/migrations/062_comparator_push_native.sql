-- Support des tokens push NATIFS (APNs/FCM) en plus du Web Push, dans la même
-- table. Un abonnement web a (endpoint, p256dh, auth) ; un abonnement natif a
-- (token, platform 'ios'|'android'). On relâche donc les NOT NULL web et on
-- ajoute `token` avec une unicité partielle. Idempotent.

ALTER TABLE "ComparatorPushSubscription"
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh   DROP NOT NULL,
  ALTER COLUMN auth     DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS token text;

-- Unicité du token natif (le ré-enregistrement d'un appareil ré-attribue la ligne).
-- Partielle : n'impacte pas les lignes web (token NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparatorpush_token
  ON "ComparatorPushSubscription" (token) WHERE token IS NOT NULL;
