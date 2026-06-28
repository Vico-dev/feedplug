-- Comparateur CSS — compte interne « comparator ».
--
-- Contexte : tous les flux marchands (AWIN) du comparateur sont ingérés sous un
-- unique compte interne dédié, dont l'id est stable et figé à « comparator ».
-- Le matching produit (domains/comparator/matching.js) et l'historique de prix
-- (price-history.js) sont gardés par cet accountid (env COMPARATOR_ACCOUNT_ID),
-- et les routes internes (routes/comparator.js) refusent toute autre cible.
--
-- Account : id String @id (sans default), plan String. On force plan='ENTERPRISE'
-- (compte non facturable, sans limites usuelles). email NULL (pas un vrai client).
--
-- Idempotent : ON CONFLICT (id) DO NOTHING — réexécuter ne duplique ni n'écrase.

INSERT INTO "Account" (id, name, plan, email, createdat, updatedat)
VALUES ('comparator', 'Feedplug Comparator (interne)', 'ENTERPRISE', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
