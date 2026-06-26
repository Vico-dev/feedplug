const test = require('node:test');
const assert = require('node:assert/strict');

const { checkAiQuota, getCap, AI_CAPS, quotaMessage } = require('../../lib/ai-caps');

/**
 * Stub Prisma : répond au SELECT plan (plan-limits.getAccountPlan) et au SELECT
 * de ai_usage par kind (ai-quota.getAiUsageByKind). On contrôle le plan et la
 * consommation déjà enregistrée par type.
 */
function createPrismaStub({ plan = 'STARTER', usage = {} }) {
  return {
    async $queryRawUnsafe(sql) {
      if (sql.includes('FROM "Account"')) {
        return [{ plan, billingstatus: 'active', paymentgraceuntil: null }];
      }
      if (sql.includes('SELECT kind, count FROM ai_usage')) {
        // Renvoie une ligne par kind ayant une conso.
        return Object.entries(usage).map(([kind, count]) => ({ kind, count }));
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };
}

test('getCap retourne la grille de référence par plan/kind', () => {
  assert.equal(getCap('STARTER', 'text'), 2000);
  assert.equal(getCap('STARTER', 'image'), 100);
  assert.equal(getCap('TIER_500', 'text'), 5000);
  assert.equal(getCap('TIER_500', 'image'), 250);
  assert.equal(getCap('PROFESSIONAL', 'text'), 10000);
  assert.equal(getCap('TIER_1000', 'image'), 500);
  assert.equal(getCap('ENTERPRISE', 'text'), 100000);
  assert.equal(getCap('TIER_50000', 'image'), 8000);
});

test('getCap retombe sur STARTER pour un plan inconnu', () => {
  assert.equal(getCap('PLAN_BIDON', 'text'), AI_CAPS.STARTER.text);
  assert.equal(getCap('PLAN_BIDON', 'image'), AI_CAPS.STARTER.image);
});

test('getCap respecte la surcharge env AI_CAP_<KIND>_<PLAN>', () => {
  const prev = process.env.AI_CAP_TEXT_STARTER;
  process.env.AI_CAP_TEXT_STARTER = '42';
  try {
    assert.equal(getCap('STARTER', 'text'), 42);
    // L'image n'est pas surchargée → grille.
    assert.equal(getCap('STARTER', 'image'), 100);
  } finally {
    if (prev === undefined) delete process.env.AI_CAP_TEXT_STARTER;
    else process.env.AI_CAP_TEXT_STARTER = prev;
  }
});

test('checkAiQuota : SOUS le cap → allowed=true avec restant correct', async () => {
  const prisma = createPrismaStub({ plan: 'STARTER', usage: { text: 100 } });
  const q = await checkAiQuota(prisma, 'acc_1', 'text', 1);
  assert.equal(q.allowed, true);
  assert.equal(q.used, 100);
  assert.equal(q.cap, 2000);
  assert.equal(q.remaining, 1900);
  assert.equal(q.plan, 'STARTER');
  assert.equal(q.kind, 'text');
});

test('checkAiQuota : AU cap exact (used+requested == cap) → allowed=true', async () => {
  const prisma = createPrismaStub({ plan: 'STARTER', usage: { text: 1999 } });
  const q = await checkAiQuota(prisma, 'acc_1', 'text', 1);
  assert.equal(q.used, 1999);
  assert.equal(q.allowed, true, 'atteindre pile le cap est autorisé');
  assert.equal(q.remaining, 1);
});

test('checkAiQuota : AU-DESSUS du cap → allowed=false', async () => {
  const prisma = createPrismaStub({ plan: 'STARTER', usage: { text: 2000 } });
  const q = await checkAiQuota(prisma, 'acc_1', 'text', 1);
  assert.equal(q.allowed, false);
  assert.equal(q.remaining, 0);
});

test('checkAiQuota : batch dont la taille dépasse le restant → allowed=false', async () => {
  const prisma = createPrismaStub({ plan: 'STARTER', usage: { text: 1990 } });
  const q = await checkAiQuota(prisma, 'acc_1', 'text', 20); // restant = 10
  assert.equal(q.remaining, 10);
  assert.equal(q.allowed, false, '20 demandées > 10 restantes → refus, pas de troncature');
});

test('checkAiQuota : compteurs texte et image sont INDÉPENDANTS', async () => {
  // Texte au cap mais images vierges : une requête image doit passer.
  const prisma = createPrismaStub({ plan: 'STARTER', usage: { text: 2000, image: 0 } });
  const qText = await checkAiQuota(prisma, 'acc_1', 'text', 1);
  const qImage = await checkAiQuota(prisma, 'acc_1', 'image', 1);
  assert.equal(qText.allowed, false, 'texte saturé');
  assert.equal(qImage.allowed, true, 'images encore disponibles');
  assert.equal(qImage.cap, 100);
});

test('checkAiQuota : caps différents selon le plan (image, PROFESSIONAL)', async () => {
  const prisma = createPrismaStub({ plan: 'PROFESSIONAL', usage: { image: 499 } });
  const ok = await checkAiQuota(prisma, 'acc_1', 'image', 1);
  const ko = await checkAiQuota(prisma, 'acc_1', 'image', 2);
  assert.equal(ok.cap, 500);
  assert.equal(ok.allowed, true);
  assert.equal(ko.allowed, false, '2 demandées, 1 restante');
});

test('quotaMessage : message explicite mentionnant le restant pour un batch', () => {
  const msg = quotaMessage({ used: 1990, cap: 2000, remaining: 10, requested: 20, kind: 'text' });
  assert.match(msg, /20/);
  assert.match(msg, /10/);
});
