-- Table pour les idées de fonctionnalités soumises par les utilisateurs (page Roadmap)

CREATE TABLE IF NOT EXISTS "feature_ideas" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "idea" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_ideas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "feature_ideas_email_idx" ON "feature_ideas"("email");
CREATE INDEX IF NOT EXISTS "feature_ideas_createdAt_idx" ON "feature_ideas"("createdAt");
