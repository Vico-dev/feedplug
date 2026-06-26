const test = require('node:test');
const assert = require('node:assert/strict');

// Sprint 2 (B-PROPER) — idempotence du worker de jobs.
// Le worker dispatche vers des handlers idempotents. Pour l'ingestion, la
// garantie d'idempotence repose sur l'upsert par (feedid, originid) : ré-exécuter
// le MÊME job (retry Cloud Tasks, double-delivery) ne crée pas de doublons —
// la 2e exécution voit les produits déjà insérés (préchargement) et fait des
// UPDATE/skip, jamais de ré-insertion.
process.env.MAX_INGEST_PRODUCTS = '1000';
const { ingestCsvFromUrl } = require('../../ingestion/csv.js');

/**
 * Prisma in-memory : modélise "FeedItem" comme un Map (feedid|originid -> row),
 * ce qui reproduit la contrainte unique uniq_feeditem_feed_origin. On peut donc
 * rejouer l'ingestion et vérifier qu'il n'y a pas de doublon.
 */
function createInMemoryPrisma() {
  const items = new Map(); // key = `${feedid}::${originid}`
  const stats = { inserts: 0, updates: 0 };
  return {
    items, stats,
    async $queryRawUnsafe(sql, p1) {
      const s = String(sql).trim();
      if (/SELECT \* FROM "FeedItem" WHERE feedid = \$1::text$/.test(s)) {
        // Préchargement : renvoie toutes les lignes du feed.
        const out = [];
        for (const [k, row] of items) if (row.feedid === p1) out.push(row);
        return out;
      }
      if (/originid = \$2::text LIMIT 1/.test(s)) {
        // Fallback unitaire (ne devrait pas servir ici).
        return [];
      }
      return [];
    },
    async $executeRawUnsafe(sql, ...args) {
      const s = String(sql).trim();
      if (/^INSERT INTO "FeedItem"/.test(s)) {
        // args: id, feedid, originid, ... contenthash @ index 18
        const [id, feedid, originid] = args;
        const contenthash = args[18];
        const key = `${feedid}::${originid}`;
        // Simule la contrainte unique : insert d'une clé existante = erreur.
        if (items.has(key)) {
          const e = new Error('duplicate key value violates unique constraint "uniq_feeditem_feed_origin"');
          e.code = 'P2010';
          throw e;
        }
        items.set(key, { id, feedid, originid, contenthash, customfields: {} });
        stats.inserts++;
        return 1;
      }
      return 1; // UPDATE etc. comptés via la 1re passe
    },
  };
}

function csv(rows) {
  return ['id,title,price', ...rows.map((r) => `${r.id},${r.title},${r.price}`)].join('\n');
}

test('runIngestionJob (idempotence) : rejouer le même import ne crée pas de doublons', async () => {
  const prisma = createInMemoryPrisma();
  const feed = { id: 'f1', mappingJson: {} };
  const text = csv([
    { id: 'A', title: 'Produit A', price: '10' },
    { id: 'B', title: 'Produit B', price: '20' },
  ]);

  // 1re exécution : 2 inserts.
  const r1 = await ingestCsvFromUrl({ prisma, feed, csvText: text });
  assert.equal(r1.totalInserted, 2, 'première passe insère A et B');
  assert.equal(prisma.items.size, 2);

  const insertsAfterFirst = prisma.stats.inserts;

  // 2e exécution du MÊME job (retry/double-delivery). Aucune ré-insertion : le
  // préchargement voit A et B déjà présents.
  const r2 = await ingestCsvFromUrl({ prisma, feed, csvText: text });
  assert.equal(prisma.stats.inserts, insertsAfterFirst, 'pas de nouvel insert au rejeu');
  assert.equal(prisma.items.size, 2, 'toujours 2 produits (pas de doublon)');
  assert.equal(r2.totalInserted, 0, 'rejeu : 0 insert');
});
