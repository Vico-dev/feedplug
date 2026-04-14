-- Lier un test A/B à une règle : quand ruleid est renseigné, le test compare
-- "ne pas appliquer la règle" (control) vs "appliquer la règle" (variant).
ALTER TABLE "ab_test" ADD COLUMN IF NOT EXISTS "ruleid" TEXT;
CREATE INDEX IF NOT EXISTS "ab_test_ruleid_idx" ON "ab_test"("ruleid");
ALTER TABLE "ab_test" ADD CONSTRAINT "ab_test_ruleid_fkey"
  FOREIGN KEY ("ruleid") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
