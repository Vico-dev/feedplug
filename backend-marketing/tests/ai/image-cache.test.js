const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildImageCacheKey,
  hashImageSource,
  getCachedImage,
  setCachedImage,
} = require('../../optimization/lifestyle-image-generator');

test('buildImageCacheKey est déterministe (mêmes entrées → même clé)', () => {
  const parts = {
    imageSourceHash: 'abc123',
    sceneDescription: 'a real modern living room',
    model: 'gemini-2.5-flash-image',
    mannequin: 'woman',
    ratio: '1:1',
  };
  const k1 = buildImageCacheKey(parts);
  const k2 = buildImageCacheKey({ ...parts });
  assert.equal(k1, k2);
  assert.match(k1, /^[a-f0-9]{64}$/, 'sha256 hex');
});

test('buildImageCacheKey change si UN composant change', () => {
  const base = {
    imageSourceHash: 'abc123',
    sceneDescription: 'living room',
    model: 'gemini-2.5-flash-image',
    mannequin: 'none',
    ratio: 'default',
  };
  const ref = buildImageCacheKey(base);
  assert.notEqual(ref, buildImageCacheKey({ ...base, imageSourceHash: 'xyz' }), 'source différente');
  assert.notEqual(ref, buildImageCacheKey({ ...base, sceneDescription: 'kitchen' }), 'scène différente');
  assert.notEqual(ref, buildImageCacheKey({ ...base, model: 'imagen-3' }), 'modèle différent');
  assert.notEqual(ref, buildImageCacheKey({ ...base, mannequin: 'man' }), 'mannequin différent');
  assert.notEqual(ref, buildImageCacheKey({ ...base, ratio: '4:5' }), 'ratio différent');
});

test('buildImageCacheKey applique des valeurs par défaut stables (mannequin/ratio absents)', () => {
  const a = buildImageCacheKey({ imageSourceHash: 'h', sceneDescription: 's', model: 'm' });
  const b = buildImageCacheKey({ imageSourceHash: 'h', sceneDescription: 's', model: 'm', mannequin: 'none', ratio: 'default' });
  assert.equal(a, b, 'absence == valeurs par défaut none/default');
});

test('hashImageSource est déterministe et distinct selon le contenu', () => {
  assert.equal(hashImageSource('AAAA'), hashImageSource('AAAA'));
  assert.notEqual(hashImageSource('AAAA'), hashImageSource('BBBB'));
  assert.match(hashImageSource('AAAA'), /^[a-f0-9]{64}$/);
});

test('getCachedImage : hit non expiré → renvoie url/contentType', async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes('FROM "ImageCache"')) {
        return [{ url: 'https://gcs/img.png', mimetype: 'image/png', expiresat: future }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const hit = await getCachedImage(prisma, 'key1');
  assert.deepEqual(hit, { url: 'https://gcs/img.png', contentType: 'image/png' });
});

test('getCachedImage : entrée expirée → null (et purge tentée)', async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  let deleted = false;
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes('SELECT url, mimetype, expiresat')) {
        return [{ url: 'https://gcs/old.png', mimetype: 'image/png', expiresat: past }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async $executeRawUnsafe(sql) {
      if (sql.includes('DELETE FROM "ImageCache"')) deleted = true;
      return 1;
    },
  };
  const hit = await getCachedImage(prisma, 'key1');
  assert.equal(hit, null);
  assert.equal(deleted, true);
});

test('getCachedImage : aucune ligne → null', async () => {
  const prisma = { async $queryRawUnsafe() { return []; } };
  assert.equal(await getCachedImage(prisma, 'key1'), null);
});

test('setCachedImage : INSERT ... ON CONFLICT (cachekey) avec les bons params', async () => {
  let captured = null;
  const prisma = {
    async $executeRawUnsafe(sql, ...params) {
      captured = { sql, params };
      return 1;
    },
  };
  await setCachedImage(prisma, 'key1', 'https://gcs/new.png', 'image/jpeg', 'acc_9');
  assert.ok(captured, 'un INSERT a été émis');
  assert.match(captured.sql, /INSERT INTO "ImageCache"/);
  assert.match(captured.sql, /ON CONFLICT \(cachekey\)/);
  assert.equal(captured.params[0], 'key1');
  assert.equal(captured.params[1], 'acc_9');
  assert.equal(captured.params[2], 'https://gcs/new.png');
  assert.equal(captured.params[3], 'image/jpeg');
});
