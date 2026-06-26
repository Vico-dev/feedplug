const test = require('node:test');
const assert = require('node:assert/strict');

const { recordAiUsage, getAiUsage, getAiUsageByKind } = require('../../lib/ai-quota');

/**
 * Stub Prisma capturant l'INSERT ai_usage : on inspecte les paramètres pour
 * vérifier que `kind` est bien propagé, et on simule le RETURNING.
 */
function createInsertStub({ returningCount = 1, alerted80 = false, alerted100 = false } = {}) {
  const calls = [];
  return {
    calls,
    prisma: {
      async $queryRawUnsafe(sql, ...params) {
        calls.push({ sql, params });
        if (sql.includes('INSERT INTO ai_usage')) {
          return [{ count: returningCount, alerted80, alerted100 }];
        }
        if (sql.includes('SELECT kind, count FROM ai_usage')) {
          return [];
        }
        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
      async $executeRawUnsafe() { return 1; },
    },
  };
}

test('recordAiUsage propage kind="text" par défaut dans l\'INSERT', async () => {
  const { prisma, calls } = createInsertStub({ returningCount: 5 });
  const r = await recordAiUsage(prisma, 'acc_1', 5);
  const insert = calls.find((c) => c.sql.includes('INSERT INTO ai_usage'));
  assert.ok(insert, 'un INSERT a été émis');
  // params : accountId, period, kind, count
  assert.equal(insert.params[2], 'text', 'kind par défaut = text');
  assert.equal(insert.params[3], 5);
  assert.equal(r.kind, 'text');
  assert.equal(r.used, 5);
});

test('recordAiUsage propage kind="image" quand demandé', async () => {
  const { prisma, calls } = createInsertStub({ returningCount: 3 });
  const r = await recordAiUsage(prisma, 'acc_1', 3, 'image');
  const insert = calls.find((c) => c.sql.includes('INSERT INTO ai_usage'));
  assert.equal(insert.params[2], 'image');
  assert.equal(r.kind, 'image');
});

test('recordAiUsage normalise un kind inconnu vers "text"', async () => {
  const { prisma, calls } = createInsertStub({ returningCount: 1 });
  await recordAiUsage(prisma, 'acc_1', 1, 'video');
  const insert = calls.find((c) => c.sql.includes('INSERT INTO ai_usage'));
  assert.equal(insert.params[2], 'text');
});

test('recordAiUsage : ON CONFLICT porte sur (accountid, period, kind)', async () => {
  const { prisma, calls } = createInsertStub();
  await recordAiUsage(prisma, 'acc_1', 1, 'image');
  const insert = calls.find((c) => c.sql.includes('INSERT INTO ai_usage'));
  assert.match(insert.sql, /ON CONFLICT \(accountid, period, kind\)/);
});

test('recordAiUsage : seuil 80% déclenché la première fois', async () => {
  // softCap = 1000 → 800 déclenche le seuil 80.
  const { prisma } = createInsertStub({ returningCount: 800, alerted80: false });
  const r = await recordAiUsage(prisma, 'acc_1', 800, 'text');
  assert.equal(r.threshold, 80);
});

test('recordAiUsage : seuil 100% déclenché à 1000', async () => {
  const { prisma } = createInsertStub({ returningCount: 1000, alerted100: false });
  const r = await recordAiUsage(prisma, 'acc_1', 1000, 'text');
  assert.equal(r.threshold, 100);
});

test('recordAiUsage : count invalide → no-op tolérant', async () => {
  const { prisma } = createInsertStub();
  const r = await recordAiUsage(prisma, 'acc_1', 0, 'text');
  assert.equal(r.used, 0);
  assert.equal(r.threshold, null);
});

test('getAiUsageByKind agrège les compteurs par type', async () => {
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes('SELECT kind, count FROM ai_usage')) {
        return [
          { kind: 'text', count: 120 },
          { kind: 'image', count: 7 },
        ];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const usage = await getAiUsageByKind(prisma, 'acc_1');
  assert.equal(usage.text, 120);
  assert.equal(usage.image, 7);
});

test('getAiUsage renvoie la forme { text:{used,cap}, image:{used,cap}, period }', async () => {
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes('SELECT kind, count FROM ai_usage')) {
        return [{ kind: 'text', count: 50 }, { kind: 'image', count: 4 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const usage = await getAiUsage(prisma, 'acc_1');
  assert.equal(usage.text.used, 50);
  assert.equal(usage.image.used, 4);
  assert.ok(usage.text.cap > 0);
  assert.ok(usage.period);
});

test('getAiUsageByKind tolère un schéma pré-A2 (pas de colonne kind)', async () => {
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes('SELECT kind, count FROM ai_usage')) {
        const err = new Error('column "kind" does not exist');
        err.code = '42703';
        throw err;
      }
      if (sql.includes('SELECT count FROM ai_usage')) {
        return [{ count: 30 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const usage = await getAiUsageByKind(prisma, 'acc_1');
  assert.equal(usage.text, 30, 'tout compte comme texte en mode legacy');
  assert.equal(usage.image, 0);
});
