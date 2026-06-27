'use strict';

/**
 * tests/jobs/performance-sync.test.js — Sync auto des performances régies
 * (reporting pré-launch). Vérifie, sans booter le monolithe :
 *  - le routage dispatchJob des 3 nouveaux types vers les bons handlers ;
 *  - l'enqueue débouncé/idempotent (dédup journalière par accountId) ;
 *  - la résolution des credentials depuis PlatformConnection puis l'appel sync ;
 *  - les no-op silencieux (pas de connexion / config incomplète / pas d'accountId)
 *    qui NE doivent PAS lever (sinon retry Cloud Tasks inutile).
 *
 * AUCUN appel réseau réel : les fonctions sync* sont stubées.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { createJobHandlers } = require('../../domains/jobs/handlers');

const JOB_TYPES = {
  AUTO_GMC_PUSH: 'auto_gmc_push',
  AUTO_OPTIMIZATION: 'auto_optimization',
  AUTO_LIA_SYNC: 'auto_lia_sync',
  INGESTION_RUN: 'ingestion_run',
  SYNC_PERF_GOOGLE_ADS: 'sync_performance_google_ads',
  SYNC_PERF_META_ADS: 'sync_performance_meta_ads',
  SYNC_PERF_AMAZON_ADS: 'sync_performance_amazon_ads',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function buildHarness(overrides = {}) {
  const calls = { enqueue: [], google: [], meta: [], amazon: [] };

  // Prisma stubé : la 1re réponse de $queryRawUnsafe est pilotée par connRows.
  const prisma = {
    connRows: [],
    async $queryRawUnsafe() {
      return prisma.connRows;
    },
    async $executeRawUnsafe() {
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
    executeGmcPush: async () => ({ succeeded: 0, failed: 0 }),
    executeLiaShopifySync: async () => ({ synced: 0, stores: 0 }),
    getActivePlatformConnectionForPush: async () => null,
    resolveDefaultFeedIdForAccount: async () => null,
    getAccountAddonIA: async () => false,
    checkAiQuota: async () => ({ allowed: true }),
    optimizeTitleWithAI: async () => null,
    optimizeDescriptionWithAI: async () => null,
    trackAiUsage: () => {},
    runIngestionJob: async () => ({ ran: 'ingestion' }),
    // Sync perf stubées.
    syncGoogleAdsPerformance: async (_p, opts) => { calls.google.push(opts); return { upserted: 5 }; },
    syncMetaAdsPerformance: async (_p, opts) => { calls.meta.push(opts); return { upserted: 3 }; },
    syncAmazonAdsPerformance: async (_p, opts) => { calls.amazon.push(opts); return { upserted: 2 }; },
    decryptSecret: (v) => (v ? `dec(${v})` : v),
    decryptPlatformConnection: (row) => ({
      ...row,
      refreshtoken: `dec(${row.refreshtoken})`,
      metadata: typeof row.metadata === 'object' && row.metadata ? row.metadata : {},
    }),
    perfAdsConfig: { googleAdsClientId: 'cfg-cid', googleAdsClientSecret: 'cfg-cs' },
  };

  Object.assign(deps, overrides);
  const handlers = createJobHandlers(deps);
  return { handlers, calls, prisma, deps };
}

// --- schedulers : enqueue avec dédup journalière ---------------------------

test('scheduleSyncGoogleAdsPerformance enqueue le bon type avec dédup journalière', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.scheduleSyncGoogleAdsPerformance('acc-1', 'oauth_connect');
  assert.equal(calls.enqueue.length, 1);
  const e = calls.enqueue[0];
  assert.equal(e.type, JOB_TYPES.SYNC_PERF_GOOGLE_ADS);
  assert.deepEqual(e.payload, { accountId: 'acc-1', reason: 'oauth_connect' });
  assert.equal(e.opts.dedupKey, 'acc-1');
  assert.equal(e.opts.dedupWindowMs, DAY_MS);
});

test('schedulers Meta et Amazon enqueue leurs types respectifs', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.scheduleSyncMetaAdsPerformance('acc-2', 'scheduler');
  await handlers.scheduleSyncAmazonAdsPerformance('acc-3', 'scheduler');
  assert.equal(calls.enqueue[0].type, JOB_TYPES.SYNC_PERF_META_ADS);
  assert.equal(calls.enqueue[1].type, JOB_TYPES.SYNC_PERF_AMAZON_ADS);
});

test('scheduleSync* sans accountId est un no-op (aucun enqueue)', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.scheduleSyncGoogleAdsPerformance(null, 'x');
  await handlers.scheduleSyncMetaAdsPerformance(undefined, 'x');
  await handlers.scheduleSyncAmazonAdsPerformance('', 'x');
  assert.equal(calls.enqueue.length, 0);
});

// --- handlers : résolution credentials + appel sync ------------------------

test('runSyncGoogleAdsPerformance résout la connexion et appelle la sync', async () => {
  const { handlers, calls, prisma } = buildHarness();
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'dev-token';
  prisma.connRows = [{ merchantid: '123-456-7890', refreshtoken: 'rt-enc' }];
  const res = await handlers.runSyncGoogleAdsPerformance({ accountId: 'acc-1', reason: 'r' });
  assert.equal(calls.google.length, 1);
  assert.equal(calls.google[0].accountId, 'acc-1');
  assert.equal(calls.google[0].customerId, '123-456-7890');
  assert.equal(calls.google[0].refreshToken, 'dec(rt-enc)');
  assert.deepEqual(res, { upserted: 5 });
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
});

test('runSyncGoogleAdsPerformance no-op (pas d\'appel sync) sans connexion active', async () => {
  const { handlers, calls, prisma } = buildHarness();
  prisma.connRows = [];
  await handlers.runSyncGoogleAdsPerformance({ accountId: 'acc-1', reason: 'r' });
  assert.equal(calls.google.length, 0);
});

test('runSyncGoogleAdsPerformance no-op si developer token absent (config incomplète)', async () => {
  const { handlers, calls, prisma } = buildHarness();
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  prisma.connRows = [{ merchantid: 'cust', refreshtoken: 'rt' }];
  await handlers.runSyncGoogleAdsPerformance({ accountId: 'acc-1', reason: 'r' });
  assert.equal(calls.google.length, 0);
});

test('runSyncMetaAdsPerformance résout adAccountId + accessToken puis sync', async () => {
  const { handlers, calls, prisma } = buildHarness();
  prisma.connRows = [{ merchantid: 'act_999', accesstoken: 'at-enc' }];
  await handlers.runSyncMetaAdsPerformance({ accountId: 'acc-2', reason: 'r' });
  assert.equal(calls.meta.length, 1);
  assert.equal(calls.meta[0].adAccountId, 'act_999');
  assert.equal(calls.meta[0].accessToken, 'dec(at-enc)');
});

test('runSyncAmazonAdsPerformance résout profil + metadata chiffrée puis sync', async () => {
  const { handlers, calls, prisma } = buildHarness();
  prisma.connRows = [{
    merchantid: 'profile-1', accesstoken: 'at', refreshtoken: 'rt',
    metadata: { clientId: 'amz-cid', clientSecret: 'amz-cs', region: 'na' },
  }];
  await handlers.runSyncAmazonAdsPerformance({ accountId: 'acc-3', reason: 'r' });
  assert.equal(calls.amazon.length, 1);
  assert.equal(calls.amazon[0].profileId, 'profile-1');
  assert.equal(calls.amazon[0].clientId, 'amz-cid');
  assert.equal(calls.amazon[0].region, 'na');
});

test('runSync* ne lève jamais sur erreur Prisma (retour silencieux, pas de retry inutile)', async () => {
  const { handlers, prisma } = buildHarness();
  prisma.$queryRawUnsafe = async () => { throw new Error('db down'); };
  await assert.doesNotReject(() => handlers.runSyncGoogleAdsPerformance({ accountId: 'a', reason: 'r' }));
  await assert.doesNotReject(() => handlers.runSyncMetaAdsPerformance({ accountId: 'a', reason: 'r' }));
  await assert.doesNotReject(() => handlers.runSyncAmazonAdsPerformance({ accountId: 'a', reason: 'r' }));
});

test('runSync* no-op sans accountId', async () => {
  const { handlers, calls } = buildHarness();
  await handlers.runSyncGoogleAdsPerformance({});
  await handlers.runSyncMetaAdsPerformance({ accountId: null });
  await handlers.runSyncAmazonAdsPerformance({});
  assert.equal(calls.google.length + calls.meta.length + calls.amazon.length, 0);
});

// --- dispatchJob : routage des nouveaux types ------------------------------

test('dispatchJob route les 3 types de sync perf vers les bons handlers', async () => {
  const { handlers, calls, prisma } = buildHarness();
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'dev-token';
  prisma.connRows = [{
    merchantid: 'm', refreshtoken: 'rt', accesstoken: 'at',
    metadata: { clientId: 'cid', clientSecret: 'cs' },
  }];
  await handlers.dispatchJob(JOB_TYPES.SYNC_PERF_GOOGLE_ADS, { accountId: 'a', reason: 'd' });
  await handlers.dispatchJob(JOB_TYPES.SYNC_PERF_META_ADS, { accountId: 'a', reason: 'd' });
  await handlers.dispatchJob(JOB_TYPES.SYNC_PERF_AMAZON_ADS, { accountId: 'a', reason: 'd' });
  assert.equal(calls.google.length, 1);
  assert.equal(calls.meta.length, 1);
  assert.equal(calls.amazon.length, 1);
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
});

test('dispatchJob lève toujours sur type inconnu (régression)', async () => {
  const { handlers } = buildHarness();
  await assert.rejects(() => handlers.dispatchJob('sync_performance_unknown', {}), /type de job inconnu/);
});
