const test = require('node:test');
const assert = require('node:assert/strict');

// B1 — coeur du gate IA : canUseFeature(prisma, accountId, 'addonIA') lit
// addonia en BDD. Le 403 HTTP lui-même est dans les handlers Express
// (server-minimal.js) et n'est pas unit-testable sans booter le serveur ;
// on teste donc la décision allowed:true/false qui le gouverne.
const { canUseFeature } = require('../../lib/plan-limits');

function createPrismaStub({ addonia }) {
  return {
    async $queryRawUnsafe(sql) {
      if (sql.includes('SELECT COALESCE(addonia, false) AS addonia')) {
        return [{ addonia, billingstatus: 'active', paymentgraceuntil: null }];
      }
      if (sql.includes('SELECT plan, billingstatus, paymentgraceuntil FROM "Account"')) {
        return [{ plan: 'TIER_500', billingstatus: 'active', paymentgraceuntil: null }];
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };
}

test('canUseFeature(addonIA) renvoie allowed:false quand addonia=false', async () => {
  const prisma = createPrismaStub({ addonia: false });
  const res = await canUseFeature(prisma, 'acc_1', 'addonIA');
  assert.equal(res.allowed, false);
  assert.ok(res.message, 'un message d\'upsell add-on IA est fourni quand refusé');
});

test('canUseFeature(addonIA) renvoie allowed:true quand addonia=true', async () => {
  const prisma = createPrismaStub({ addonia: true });
  const res = await canUseFeature(prisma, 'acc_1', 'addonIA');
  assert.equal(res.allowed, true);
  assert.equal(res.message, undefined);
});
