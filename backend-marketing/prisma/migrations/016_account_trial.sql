-- Migration 016 : Essai gratuit 30 jours
-- Ajoute trialEndsAt à Account pour gérer la période d'essai

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS trialendsat TIMESTAMPTZ;
