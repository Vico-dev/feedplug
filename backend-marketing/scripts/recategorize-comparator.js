'use strict';
// Reclasse tout le stock de ProductGroup du comparateur (sans re-ingestion).
// Usage : DATABASE_URL=... node scripts/recategorize-comparator.js
const { PrismaClient } = require('@prisma/client');
const { categorizeGroups } = require('../domains/comparator/categorization');

(async () => {
  const url = process.env.DATABASE_URL || process.env.SMOKE_DB;
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  try {
    const res = await categorizeGroups(prisma, {});
    console.log('[recategorize]', JSON.stringify(res));
    const dist = await prisma.$queryRawUnsafe(
      `SELECT categoryid, count(*)::int AS n FROM "ProductGroupCategory" GROUP BY categoryid ORDER BY n DESC`,
    );
    console.log('[distribution]', JSON.stringify(dist));
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('[recategorize] FAIL:', e.message); process.exit(1); });
