-- Phase 1 AWIN — statut d'approbation par source.
--
-- La licence AWIN est par advertiser, révocable, et certains marchands refusent le
-- canal CSS/comparaison. Une offre n'est donc éligible au comparateur que si sa
-- source est 'approved'. Défaut 'pending' = invisible (fail-safe : un flux nouvellement
-- ajouté ne fuite pas avant validation manuelle). Le gating est appliqué au matching
-- (hook post-ingestion) : une source non approuvée voit ses offres détachées.
-- Idempotent.
ALTER TABLE "FeedSource" ADD COLUMN IF NOT EXISTS approvalstatus TEXT NOT NULL DEFAULT 'pending';
-- valeurs : 'pending' | 'approved' | 'rejected' | 'revoked'

-- Index partiel : les requêtes publiques ne lisent que les sources approuvées.
CREATE INDEX IF NOT EXISTS idx_feedsource_approval ON "FeedSource"(approvalstatus) WHERE approvalstatus = 'approved';
