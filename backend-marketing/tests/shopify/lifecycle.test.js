const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleAppUninstalled,
  matchPendingSubscriptionToWebhook,
} = require('../../domains/shopify/lifecycle');

function createPrismaMock({ existingSub = null, pendingRows = [] } = {}) {
  const calls = [];

  async function $executeRawUnsafe(query, ...args) {
    calls.push({ kind: 'execute', query, args });
    return 1;
  }

  async function $queryRawUnsafe(query, ...args) {
    calls.push({ kind: 'query', query, args });
    if (/FROM shopify_subscriptions WHERE shopify_subscription_id =/i.test(query)) {
      return existingSub ? [{ id: existingSub }] : [];
    }
    if (/FROM\s+shopify_subscriptions[\s\S]*status = 'PENDING'/i.test(query)) {
      return pendingRows;
    }
    return [];
  }

  return { prisma: { $executeRawUnsafe, $queryRawUnsafe }, calls };
}

// ──────────────────────────────────────────────────────────────────────────
// handleAppUninstalled
// ──────────────────────────────────────────────────────────────────────────

test('handleAppUninstalled refuse si shopDomain manquant', async () => {
  const { prisma } = createPrismaMock();
  const result = await handleAppUninstalled({ prisma, shopDomain: '' });
  assert.equal(result.ok, false);
  assert.match(result.error, /shopDomain/);
});

test('handleAppUninstalled refuse si prisma indisponible', async () => {
  const result = await handleAppUninstalled({ prisma: null, shopDomain: 'demo.myshopify.com' });
  assert.equal(result.ok, false);
  assert.match(result.error, /prisma/);
});

test('handleAppUninstalled met FeedSource en PAUSED + subscriptions en CANCELLED', async () => {
  const { prisma, calls } = createPrismaMock();
  const result = await handleAppUninstalled({
    prisma,
    shopDomain: 'demo.myshopify.com',
  });

  assert.equal(result.ok, true);

  const sourcesUpdate = calls.find(
    (c) => c.kind === 'execute' && /UPDATE "FeedSource"/i.test(c.query)
  );
  assert.ok(sourcesUpdate, 'doit update FeedSource');
  assert.match(sourcesUpdate.query, /PAUSED/, 'doit set status à PAUSED (pas INACTIVE, refusé par check constraint)');
  assert.equal(sourcesUpdate.args[0], 'demo.myshopify.com');

  const subsUpdate = calls.find(
    (c) => c.kind === 'execute' && /UPDATE shopify_subscriptions/i.test(c.query)
  );
  assert.ok(subsUpdate, 'doit update shopify_subscriptions');
  assert.match(subsUpdate.query, /CANCELLED/, 'doit set status à CANCELLED');
  assert.match(subsUpdate.query, /cancelled_at = NOW\(\)/, 'doit poser cancelled_at');
  assert.match(subsUpdate.query, /\bIN \('PENDING', 'ACTIVE'\)/, 'doit cibler PENDING + ACTIVE');
});

test('handleAppUninstalled ne casse pas le serveur si la DB throw', async () => {
  const errPrisma = {
    $executeRawUnsafe: async () => { throw new Error('DB down'); },
    $queryRawUnsafe: async () => [],
  };
  const result = await handleAppUninstalled({
    prisma: errPrisma,
    shopDomain: 'demo.myshopify.com',
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /DB down/);
});

// ──────────────────────────────────────────────────────────────────────────
// matchPendingSubscriptionToWebhook
// ──────────────────────────────────────────────────────────────────────────

test('matchPendingSubscriptionToWebhook : sub déjà en DB → matched sans rien faire', async () => {
  const { prisma, calls } = createPrismaMock({ existingSub: 'sub-row-1' });

  const result = await matchPendingSubscriptionToWebhook({
    prisma,
    shopifySubscriptionId: 'gid://shopify/AppSubscription/999',
    shopDomain: 'demo.myshopify.com',
    subscriptionName: 'Pro',
    status: 'ACTIVE',
  });

  assert.equal(result.matched, true);
  assert.equal(result.rowId, 'sub-row-1');

  // Pas d'UPDATE de promotion (la sub est déjà à jour, markShopifySubscriptionStatus
  // s'occupe du status downstream).
  const updates = calls.filter(
    (c) => c.kind === 'execute' && /UPDATE shopify_subscriptions/i.test(c.query)
  );
  assert.equal(updates.length, 0);
});

test('matchPendingSubscriptionToWebhook : premier webhook ACTIVE promeut une row PENDING', async () => {
  const { prisma, calls } = createPrismaMock({
    existingSub: null,
    pendingRows: [{ id: 'pending-row-id' }],
  });

  const result = await matchPendingSubscriptionToWebhook({
    prisma,
    shopifySubscriptionId: 'gid://shopify/AppSubscription/12345',
    shopDomain: 'demo.myshopify.com',
    subscriptionName: 'Pro',
    status: 'ACTIVE',
  });

  assert.equal(result.matched, true);
  assert.equal(result.rowId, 'pending-row-id');

  // La query PENDING filtre par shop + plan_key uppercase
  const pendingQuery = calls.find(
    (c) =>
      c.kind === 'query' &&
      /FROM\s+shopify_subscriptions[\s\S]*status = 'PENDING'/i.test(c.query)
  );
  assert.ok(pendingQuery);
  assert.equal(pendingQuery.args[0], 'demo.myshopify.com');
  assert.equal(pendingQuery.args[1], 'PRO', 'plan_key doit être uppercase');

  // L'UPDATE remplace l'id provisoire par le gid:// reçu
  const update = calls.find(
    (c) =>
      c.kind === 'execute' &&
      /UPDATE shopify_subscriptions SET shopify_subscription_id/i.test(c.query)
  );
  assert.ok(update);
  assert.equal(update.args[0], 'pending-row-id');
  assert.equal(update.args[1], 'gid://shopify/AppSubscription/12345');
});

test('matchPendingSubscriptionToWebhook : webhook non-ACTIVE inconnu → skip promotion', async () => {
  const { prisma, calls } = createPrismaMock({
    existingSub: null,
    pendingRows: [{ id: 'pending-row' }],
  });

  const result = await matchPendingSubscriptionToWebhook({
    prisma,
    shopifySubscriptionId: 'gid://shopify/AppSubscription/12345',
    shopDomain: 'demo.myshopify.com',
    subscriptionName: 'Pro',
    status: 'CANCELLED',
  });

  assert.equal(result.matched, false);

  // Ne doit pas avoir cherché une row PENDING (car status != ACTIVE)
  const pendingQuery = calls.find(
    (c) => c.kind === 'query' && /status = 'PENDING'/i.test(c.query)
  );
  assert.equal(pendingQuery, undefined);
});

test('matchPendingSubscriptionToWebhook : aucune row PENDING matching → pas matched', async () => {
  const { prisma } = createPrismaMock({
    existingSub: null,
    pendingRows: [],
  });

  const result = await matchPendingSubscriptionToWebhook({
    prisma,
    shopifySubscriptionId: 'gid://shopify/AppSubscription/12345',
    shopDomain: 'demo.myshopify.com',
    subscriptionName: 'Pro',
    status: 'ACTIVE',
  });

  assert.equal(result.matched, false);
});

test('matchPendingSubscriptionToWebhook : args invalides → matched false sans throw', async () => {
  const { prisma } = createPrismaMock();
  const result = await matchPendingSubscriptionToWebhook({
    prisma,
    shopifySubscriptionId: '',
    shopDomain: 'demo.myshopify.com',
    subscriptionName: 'Pro',
    status: 'ACTIVE',
  });
  assert.equal(result.matched, false);
});
