'use strict';

/**
 * tests/jobs/handlers.test.js — Tests unitaires du bloc 1 extrait
 * (domains/jobs/handlers.js). Gain principal du refacto strangler : les handlers
 * sont désormais testables via la factory + stubs Prisma/deps, sans booter le
 * monolithe server-minimal.js.
 *
 * On vérifie le comportement préservé : gates IA (addonIA), cap IA (checkAiQuota),
 * idempotence (filtre des items déjà optimisés), debounce/enqueue, et le routage
 * dispatchJob. AUCUN appel réseau réel : tout est stubé.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { createJobHandlers } = require('../../domains/jobs/handlers');

const JOB_TYPES = {
  AUTO_GMC_PUSH: 'auto_gmc_push',
  AUTO_OPTIMIZATION: 'auto_optimization',
  AUTO_LIA_SYNC: 'auto_lia_sync',
  INGESTION_RUN: 'ingestion_run',
};

// Construit une factory avec des deps stubées et des compteurs d'appels.
function buildHarness(overrides = {}) {
  const calls = {
    enqueue: [],
    gmcPush: [],
    liaSync: [],
    optimizeTitle: [],
    optimizeDesc: [],
    trackAiUsage: [],
    updates: [],
  };

  const prisma = {
    queryResult: [],
    async $queryRawUnsafe() {
      return prisma.queryResult;
    },
    async $executeRawUnsafe(...args) {
      calls.updates.push(args);
      return 1;
    },
  };

  const deps = {
    getPrisma: () => prisma,
    enqueueBackgroundJob: async (type, payload, opts) => {
      calls.enqueue.push({ type, payload, opts });
      return { mode: 'in-process' };
    },
    JOB_TYPES,
    AUTO_GMC_PUSH_DEBOUNCE_MS: 30000,
    AUTO_OPTIM_DEBOUNCE_MS: 15000,
    AUTO_OPTIM_BATCH_SIZE: 50,
    executeGmcPush: async (args) => {
      calls.gmcPush.push(args);
      return { succeeded: 1, failed: 0 };
    },
    executeLiaShopifySync: async (accountId) => {
      calls.liaSync.push(accountId);
      return { synced: 3, stores: 2 };
    },
    getActivePlatformConnectionForPush: async () => ({ merchantid: 'mc-1' }),
    resolveDefaultFeedIdForAccount: async () => 'default-feed',
    getAccountAddonIA: async () => true,
    checkAiQuota: async () => ({ allowed: true, used: 0, cap: 1000 }),
    optimizeTitleWithAI: async (_p, product) => {
      calls.optimizeTitle.push(product.id);
      return { optimizedTitle: 'OPT ' + product.title };
    },
    optimizeDescriptionWithAI: async (_p, product) => {
      calls.optimizeDesc.push(product.id);
      return { optimizedDescription: 'OPT ' + product.description };
    },
    trackAiUsage: (accountId, count) => {
      calls.trackAiUsage.push({ accountId, count });
    },
    runIngestionJob: async (payload) => ({ ran: 'ingestion', payload }),
  };

  Object.assign(deps, overrides);
  const handlers = createJobHandlers(deps);
  return { handlers, calls, prisma, deps };
}

// --- scheduleAutoOptimization ----------------------------------------------

test('scheduleAutoOptimization sans feedId délègue directement au push GMC (pas d\'enqueue optim)', () => {
  const { handlers, calls } = buildHarness();
  handlers.scheduleAutoOptimization('acc-1', null, 'test');
  // Aucun enqueue auto_optimization ; un seul enqueue auto_gmc_push.
  const optimEnqueues = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_OPTIMIZATION);
  const gmcEnqueues = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_GMC_PUSH);
  assert.equal(optimEnqueues.length, 0);
  assert.equal(gmcEnqueues.length, 1);
});

test('scheduleAutoOptimization avec feedId enqueue un job auto_optimization débouncé', () => {
  const { handlers, calls } = buildHarness();
  handlers.scheduleAutoOptimization('acc-1', 'feed-9', 'ingestion', 12345);
  const optimEnqueues = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_OPTIMIZATION);
  assert.equal(optimEnqueues.length, 1);
  const e = optimEnqueues[0];
  assert.deepEqual(e.payload, { accountId: 'acc-1', feedId: 'feed-9', reason: 'ingestion' });
  assert.equal(e.opts.dedupKey, 'acc-1:feed-9');
  assert.equal(e.opts.scheduleDelayMs, 12345);
  assert.equal(e.opts.dedupWindowMs, 15000);
});

test('scheduleAutoOptimization sans accountId est un no-op', () => {
  const { handlers, calls } = buildHarness();
  handlers.scheduleAutoOptimization(null, 'feed-9', 'x');
  assert.equal(calls.enqueue.length, 0);
});

// --- runAutoOptimization : gates et chemin nominal --------------------------

test('runAutoOptimization sans pack IA pousse le contenu brut (push GMC, pas d\'optim)', async () => {
  const { handlers, calls } = buildHarness({ getAccountAddonIA: async () => false });
  await handlers.runAutoOptimization({ accountId: 'acc-1', feedId: 'feed-1', reason: 'r' });
  assert.equal(calls.optimizeTitle.length, 0);
  // push GMC programmé (delay 0) car pas de pack IA.
  const gmc = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_GMC_PUSH);
  assert.equal(gmc.length, 1);
  assert.equal(gmc[0].opts.scheduleDelayMs, 0);
});

test('runAutoOptimization plafond IA atteint pousse le brut sans appeler l\'IA', async () => {
  const { handlers, calls, prisma } = buildHarness({
    checkAiQuota: async () => ({ allowed: false, used: 1000, cap: 1000 }),
  });
  prisma.queryResult = [{ id: 'i1', title: 'T', descriptiontext: 'D', customfields: null }];
  await handlers.runAutoOptimization({ accountId: 'acc-1', feedId: 'feed-1', reason: 'r' });
  assert.equal(calls.optimizeTitle.length, 0, 'l\'IA ne doit pas être appelée au plafond');
  const gmc = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_GMC_PUSH);
  assert.equal(gmc.length, 1);
});

test('runAutoOptimization sans items à optimiser pousse directement (idempotence)', async () => {
  const { handlers, calls, prisma } = buildHarness();
  prisma.queryResult = []; // tout déjà optimisé
  await handlers.runAutoOptimization({ accountId: 'acc-1', feedId: 'feed-1', reason: 'r' });
  assert.equal(calls.optimizeTitle.length, 0);
  const gmc = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_GMC_PUSH);
  assert.equal(gmc.length, 1);
});

test('runAutoOptimization chemin nominal : optimise, UPDATE, track IA, puis push GMC', async () => {
  const { handlers, calls, prisma } = buildHarness();
  prisma.queryResult = [
    { id: 'i1', title: 'Titre 1', descriptiontext: 'Desc 1', customfields: null, price: 10, currency: 'EUR' },
    { id: 'i2', title: 'Titre 2', descriptiontext: 'Desc 2', customfields: {}, price: 20, currency: 'EUR' },
  ];
  await handlers.runAutoOptimization({ accountId: 'acc-1', feedId: 'feed-1', reason: 'nominal' });
  assert.equal(calls.optimizeTitle.length, 2);
  assert.equal(calls.optimizeDesc.length, 2);
  assert.equal(calls.updates.length, 2, 'un UPDATE jsonb_set par item optimisé');
  // trackAiUsage appelé avec le nombre d'items réussis.
  assert.equal(calls.trackAiUsage.length, 1);
  assert.equal(calls.trackAiUsage[0].count, 2);
  const gmc = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_GMC_PUSH);
  assert.equal(gmc.length, 1, 'push GMC post-optim');
});

test('runAutoOptimization : erreur Prisma => fallback push GMC (mieux du brut que rien)', async () => {
  const { handlers, calls, prisma } = buildHarness();
  prisma.$queryRawUnsafe = async () => { throw new Error('boom'); };
  await handlers.runAutoOptimization({ accountId: 'acc-1', feedId: 'feed-1', reason: 'r' });
  const gmc = calls.enqueue.filter((e) => e.type === JOB_TYPES.AUTO_GMC_PUSH);
  assert.equal(gmc.length, 1);
  assert.match(gmc[0].payload.reason, /fallback/);
});

test('runAutoOptimization sans accountId/feedId est un no-op', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.runAutoOptimization({ accountId: null, feedId: 'f' });
  await handlers.runAutoOptimization({ accountId: 'a', feedId: null });
  assert.equal(calls.enqueue.length, 0);
  assert.equal(calls.optimizeTitle.length, 0);
});

// --- runAutoGmcPush ---------------------------------------------------------

test('runAutoGmcPush no-op si pas de connexion GMC active', async () => {
  const { handlers, calls } = buildHarness({ getActivePlatformConnectionForPush: async () => null });
  await handlers.runAutoGmcPush({ accountId: 'acc-1', feedId: 'feed-1', reason: 'r' });
  assert.equal(calls.gmcPush.length, 0);
});

test('runAutoGmcPush résout le feed par défaut quand feedId absent', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.runAutoGmcPush({ accountId: 'acc-1', feedId: null, reason: 'r' });
  assert.equal(calls.gmcPush.length, 1);
  assert.equal(calls.gmcPush[0].feedId, 'default-feed');
});

// --- runAutoLiaSync ---------------------------------------------------------

test('runAutoLiaSync délègue à executeLiaShopifySync', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.runAutoLiaSync({ accountId: 'acc-1', reason: 'r' });
  assert.deepEqual(calls.liaSync, ['acc-1']);
});

test('runAutoLiaSync no-op sans accountId', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.runAutoLiaSync({ accountId: null, reason: 'r' });
  assert.equal(calls.liaSync.length, 0);
});

// --- dispatchJob ------------------------------------------------------------

test('dispatchJob route chaque type vers le bon handler', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.dispatchJob(JOB_TYPES.AUTO_LIA_SYNC, { accountId: 'a', reason: 'r' });
  assert.equal(calls.liaSync.length, 1);

  const ingestionResult = await handlers.dispatchJob(JOB_TYPES.INGESTION_RUN, { feedId: 'f' });
  assert.equal(ingestionResult.ran, 'ingestion');
});

test('dispatchJob lève sur type inconnu', async () => {
  const { handlers } = buildHarness();
  await assert.rejects(() => handlers.dispatchJob('inconnu', {}), /type de job inconnu/);
});

test('dispatchJob lève si runIngestionJob non injecté', async () => {
  const { handlers } = buildHarness({ runIngestionJob: undefined });
  await assert.rejects(() => handlers.dispatchJob(JOB_TYPES.INGESTION_RUN, {}), /runIngestionJob non injecté/);
});
