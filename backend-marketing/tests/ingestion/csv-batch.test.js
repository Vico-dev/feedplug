const test = require('node:test');
const assert = require('node:assert/strict');

// Sprint 2 (B-PROPER) — vérifie que ingestCsvFromUrl précharge les lignes
// existantes en UNE requête (plus de SELECT par produit = N+1 supprimé) et
// produit les bons counts insert/update sur un petit jeu.
process.env.MAX_INGEST_PRODUCTS = '1000';
const { ingestCsvFromUrl } = require('../../ingestion/csv.js');

function buildCsv(rows) {
  const lines = ['id,title,price'];
  for (const r of rows) lines.push(`${r.id},${r.title},${r.price}`);
  return lines.join('\n');
}

// Stub Prisma instrumenté : compte les requêtes par "type" pour prouver l'absence
// de SELECT par produit.
function createInstrumentedPrisma(existing) {
  const stats = { perProductSelect: 0, bulkPreload: 0, inserts: 0, updates: 0, otherSelect: 0 };
  const existingRows = existing.map((e, i) => ({
    id: `existing-${i}`,
    feedid: 'f1',
    originid: e.id,
    contenthash: '__force_update__', // hash différent => déclenche un UPDATE
    customfields: {},
  }));
  return {
    stats,
    async $queryRawUnsafe(sql) {
      const s = String(sql);
      // Préchargement bulk : SELECT * sans clause originid.
      if (/SELECT \* FROM "FeedItem" WHERE feedid = \$1::text\s*$/.test(s.trim())) {
        stats.bulkPreload++;
        return existingRows;
      }
      // SELECT par produit (ne doit PAS arriver quand le préchargement marche).
      if (/originid = \$2::text LIMIT 1/.test(s)) {
        stats.perProductSelect++;
        return [];
      }
      stats.otherSelect++;
      return [];
    },
    async $executeRawUnsafe(sql) {
      const s = String(sql);
      if (/^\s*INSERT INTO "FeedItem"/.test(s)) stats.inserts++;
      else if (/^\s*UPDATE "FeedItem"/.test(s)) stats.updates++;
      return 1;
    },
  };
}

test('ingestCsvFromUrl: préchargement en 1 requête, 0 SELECT par produit, counts corrects', async () => {
  // 1 produit existant (A => update car hash différent) + 1 nouveau (B => insert).
  const prisma = createInstrumentedPrisma([{ id: 'A' }]);
  const feed = { id: 'f1', mappingJson: {} };
  const csvText = buildCsv([
    { id: 'A', title: 'Produit A', price: '10.00' },
    { id: 'B', title: 'Produit B', price: '20.00' },
  ]);

  const result = await ingestCsvFromUrl({ prisma, feed, csvText });

  assert.equal(prisma.stats.bulkPreload, 1, 'un seul préchargement bulk');
  assert.equal(prisma.stats.perProductSelect, 0, 'aucun SELECT par produit (N+1 supprimé)');
  assert.equal(prisma.stats.inserts, 1, '1 insert (B nouveau)');
  assert.equal(prisma.stats.updates, 1, '1 update (A existant, hash changé)');
  assert.equal(result.totalInserted, 1);
  assert.equal(result.totalUpdated, 1);
});
