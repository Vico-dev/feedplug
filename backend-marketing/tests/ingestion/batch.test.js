const test = require('node:test');
const assert = require('node:assert/strict');

// Sprint 2 (B-PROPER) — batching/préchargement de l'ingestion (fix N+1).
const { chunk, preloadExistingByOriginId } = require('../../lib/ingest-batch.js');

test('chunk: découpe correcte', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 10), []);
  assert.deepEqual(chunk([1, 2, 3], 100), [[1, 2, 3]]);
});

test('preloadExistingByOriginId: UNE requête (WHERE originid = ANY) pour N ids -> Map indexée', async () => {
  let queryCount = 0;
  let capturedParams = null;
  const prisma = {
    async $queryRawUnsafe(sql, feedId, ids) {
      queryCount++;
      capturedParams = { sql, feedId, ids };
      // Simule 2 lignes existantes sur 3 demandées.
      return [
        { id: 'i1', originid: 'A', contenthash: 'h1' },
        { id: 'i2', originid: 'B', contenthash: 'h2' },
      ];
    },
  };
  const map = await preloadExistingByOriginId(prisma, 'feed1', ['A', 'B', 'C']);
  assert.equal(queryCount, 1, 'un seul SELECT pour tout le lot (N+1 supprimé)');
  assert.match(capturedParams.sql, /= ANY\(\$2::text\[\]\)/, 'utilise = ANY($2)');
  assert.equal(capturedParams.feedId, 'feed1');
  assert.deepEqual(capturedParams.ids, ['A', 'B', 'C']);
  assert.equal(map.size, 2);
  assert.equal(map.get('A').id, 'i1');
  assert.equal(map.get('C'), undefined, 'C absent => sera traité comme insert');
});

test('preloadExistingByOriginId: chunking -> nb de requêtes = ceil(N/chunkSize)', async () => {
  let queryCount = 0;
  const prisma = {
    async $queryRawUnsafe() { queryCount++; return []; },
  };
  const ids = Array.from({ length: 2500 }, (_, i) => `id-${i}`);
  await preloadExistingByOriginId(prisma, 'feed1', ids, { chunkSize: 1000 });
  assert.equal(queryCount, 3, '2500 ids / 1000 = 3 chunks');
});

test('preloadExistingByOriginId: dédoublonne les originIds avant requête', async () => {
  let captured = null;
  const prisma = {
    async $queryRawUnsafe(sql, feedId, ids) { captured = ids; return []; },
  };
  await preloadExistingByOriginId(prisma, 'feed1', ['A', 'A', 'B', 'B', 'B']);
  assert.deepEqual(captured, ['A', 'B'], 'ids uniques');
});

test('preloadExistingByOriginId: liste vide -> aucune requête, Map vide', async () => {
  let queryCount = 0;
  const prisma = { async $queryRawUnsafe() { queryCount++; return []; } };
  const map = await preloadExistingByOriginId(prisma, 'feed1', []);
  assert.equal(queryCount, 0);
  assert.equal(map.size, 0);
});
