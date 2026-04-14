-- Migration 020 : User status et lastLoginAt (invitation + login)
-- Permet de distinguer utilisateurs invités (INACTIVE) vs actifs (ACTIVE)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS lastloginat TIMESTAMPTZ;

-- Mettre à jour les utilisateurs existants sans status (au cas où la colonne existait sans default)
UPDATE "User" SET status = 'ACTIVE' WHERE status IS NULL;
