const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canUseFeature,
  checkChannelLimit,
  checkPlanLimit,
  getAccountPlan,
  getPlanCapabilitiesForApi,
} = require('../../lib/plan-limits');

function createPrismaStub(rowsBySql) {
  return {
    async $queryRawUnsafe(sql) {
      for (const [pattern, result] of rowsBySql) {
        if (sql.includes(pattern)) {
          return typeof result === 'function' ? result(sql) : result;
        }
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };
}

test('getAccountPlan falls back to STARTER when pending grace is expired', async () => {
  const prisma = createPrismaStub([
    ['SELECT plan, billingstatus, paymentgraceuntil FROM "Account"', [
      { plan: 'PROFESSIONAL', billingstatus: 'pending', paymentgraceuntil: '2020-01-01T00:00:00.000Z' },
    ]],
  ]);

  const plan = await getAccountPlan(prisma, 'acc_1');
  assert.equal(plan, 'STARTER');
});

test('checkPlanLimit enforces product caps for tier plans', async () => {
  const prisma = createPrismaStub([
    ['SELECT plan, billingstatus, paymentgraceuntil FROM "Account"', [{ plan: 'TIER_1000', billingstatus: 'active', paymentgraceuntil: null }]],
  ]);

  const allowed = await checkPlanLimit(prisma, 'acc_1', 'maxProducts', 999);
  const blocked = await checkPlanLimit(prisma, 'acc_1', 'maxProducts', 1000);

  assert.equal(allowed.allowed, true);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.limit, 1000);
});

test('checkChannelLimit respects account-specific caps', async () => {
  const prisma = createPrismaStub([
    ['SELECT max_channels, billingstatus, paymentgraceuntil FROM "Account"', [{ max_channels: 3, billingstatus: 'active', paymentgraceuntil: null }]],
  ]);

  const result = await checkChannelLimit(prisma, 'acc_1', 3);
  assert.equal(result.allowed, false);
  assert.match(result.message || '', /3 canaux/);
});

test('canUseFeature exposes addon IA and plan capabilities consistently', async () => {
  const prisma = {
    async $queryRawUnsafe(sql) {
      if (sql.includes('SELECT COALESCE(addonia, false) AS addonia')) {
        return [{ addonia: true, billingstatus: 'active', paymentgraceuntil: null }];
      }
      if (sql.includes('SELECT plan, billingstatus, paymentgraceuntil FROM "Account"')) {
        return [{ plan: 'TIER_500', billingstatus: 'active', paymentgraceuntil: null }];
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };

  const addonIA = await canUseFeature(prisma, 'acc_1', 'addonIA');
  const capabilities = getPlanCapabilitiesForApi('TIER_500', true, 4);

  assert.equal(addonIA.allowed, true);
  assert.equal(capabilities.plan, 'TIER_500');
  assert.equal(capabilities.features.addonIA, true);
  assert.equal(capabilities.limits.maxProducts, 500);
  assert.equal(capabilities.limits.maxChannels, 4);
});
