-- Export planifié : opt-in par flux. Quand autopush_enabled = true, le flux est
-- re-poussé automatiquement vers les canaux connectés (GMC / Amazon) une fois
-- par jour, via le job Cloud Scheduler feedplug-scheduled-exports.
ALTER TABLE "Feed" ADD COLUMN IF NOT EXISTS autopush_enabled BOOLEAN NOT NULL DEFAULT false;
