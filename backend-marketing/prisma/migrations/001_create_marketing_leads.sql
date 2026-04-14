-- Migration SQL pour créer la table marketing_leads
-- À exécuter sur votre base de données PostgreSQL

CREATE TABLE IF NOT EXISTS "marketing_leads" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "locale" TEXT,
    "source" TEXT,
    "status" TEXT DEFAULT 'new',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_leads_pkey" PRIMARY KEY ("id")
);

-- Index unique sur email
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_leads_email_key" ON "marketing_leads"("email");

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "marketing_leads_email_idx" ON "marketing_leads"("email");
CREATE INDEX IF NOT EXISTS "marketing_leads_createdAt_idx" ON "marketing_leads"("createdAt");
CREATE INDEX IF NOT EXISTS "marketing_leads_status_idx" ON "marketing_leads"("status");



