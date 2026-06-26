const test = require('node:test');
const assert = require('node:assert/strict');

// B-STOP2 — plafond d'ingestion synchrone (MAX_INGEST_PRODUCTS).
// On fixe le plafond à 3 AVANT de require() le module : la constante est lue
// au runtime (Number(process.env.MAX_INGEST_PRODUCTS || 5000)) dans le handler,
// donc l'override prend effet par appel.
process.env.MAX_INGEST_PRODUCTS = '3';

const { ingestCsvFromUrl } = require('../../ingestion/csv.js');

/** Prisma stub minimal : aucune écriture réelle, lectures vides. */
function createPrismaStub() {
  return {
    async $executeRawUnsafe() {
      return 1;
    },
    async $queryRawUnsafe() {
      return [];
    },
  };
}

/** Génère un CSV avec un header + `count` lignes de données. */
function buildCsv(count) {
  const lines = ['id,title,price'];
  for (let i = 0; i < count; i++) {
    lines.push(`SKU-${i},Produit ${i},9.99`);
  }
  return lines.join('\n');
}

test('ingestCsvFromUrl throws 413 INGEST_TOO_LARGE above MAX_INGEST_PRODUCTS', async () => {
  const prisma = createPrismaStub();
  const feed = { id: 'f1' };
  const csvText = buildCsv(5); // 5 > 3

  await assert.rejects(
    () => ingestCsvFromUrl({ prisma, feed, csvText }),
    (err) => {
      assert.equal(err.statusCode, 413);
      assert.equal(err.code, 'INGEST_TOO_LARGE');
      return true;
    }
  );
});

test('ingestCsvFromUrl does not throw the cap error below MAX_INGEST_PRODUCTS', async () => {
  const prisma = createPrismaStub();
  const feed = { id: 'f1' };
  const csvText = buildCsv(2); // 2 <= 3

  // Ne doit PAS throw pour le motif "trop volumineux". Le run se termine
  // normalement (stub renvoie [] pour les SELECT, donc tout est inséré).
  const result = await ingestCsvFromUrl({ prisma, feed, csvText });
  assert.equal(result.totalFetched, 2);
});
