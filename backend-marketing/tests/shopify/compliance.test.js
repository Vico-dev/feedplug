const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMPLIANCE_TOPICS,
  isComplianceTopic,
  processComplianceWebhook,
  handleShopRedact,
} = require('../../domains/shopify/compliance');

/**
 * Prisma mock minimal : enregistre les requêtes et renvoie des données contrôlées.
 */
function createPrismaMock({ credentialIds = [], sourceIds = [], feedIds = [] } = {}) {
  const calls = [];

  function $executeRawUnsafe(query, ...args) {
    calls.push({ kind: 'execute', query, args });
    // Simule un nombre de lignes affectées par DELETE
    if (/DELETE FROM "FeedItem"/i.test(query)) return Promise.resolve(42);
    if (/DELETE FROM "Feed"/i.test(query)) return Promise.resolve(feedIds.length);
    if (/DELETE FROM "FeedSource"/i.test(query)) return Promise.resolve(sourceIds.length);
    if (/DELETE FROM "Credential"/i.test(query)) return Promise.resolve(credentialIds.length);
    if (/DELETE FROM "EnrichmentSource"/i.test(query)) return Promise.resolve(0);
    if (/DELETE FROM "IngestionRun"/i.test(query)) return Promise.resolve(0);
    return Promise.resolve(0);
  }

  function $queryRawUnsafe(query, ...args) {
    calls.push({ kind: 'query', query, args });
    if (/FROM "Credential"/i.test(query)) {
      return Promise.resolve(credentialIds.map((id) => ({ id })));
    }
    if (/FROM "FeedSource"/i.test(query)) {
      return Promise.resolve(sourceIds.map((id) => ({ id })));
    }
    if (/FROM "Feed"\s/i.test(query) && /WHERE sourceid/i.test(query)) {
      return Promise.resolve(feedIds.map((id) => ({ id })));
    }
    return Promise.resolve([]);
  }

  return {
    prisma: { $executeRawUnsafe, $queryRawUnsafe },
    calls,
  };
}

test('isComplianceTopic reconnaît les 3 topics GDPR', () => {
  assert.equal(isComplianceTopic(COMPLIANCE_TOPICS.CUSTOMERS_DATA_REQUEST), true);
  assert.equal(isComplianceTopic(COMPLIANCE_TOPICS.CUSTOMERS_REDACT), true);
  assert.equal(isComplianceTopic(COMPLIANCE_TOPICS.SHOP_REDACT), true);
  assert.equal(isComplianceTopic('app/uninstalled'), false);
  assert.equal(isComplianceTopic('orders/create'), false);
  assert.equal(isComplianceTopic(''), false);
});

test('processComplianceWebhook persiste la requête puis marque processed', async () => {
  const { prisma, calls } = createPrismaMock();
  const result = await processComplianceWebhook({
    prisma,
    topic: COMPLIANCE_TOPICS.CUSTOMERS_DATA_REQUEST,
    shopDomain: 'demo-shop.myshopify.com',
    payload: { customer: { id: 1 } },
    notifyAdmin: async () => null,
  });

  assert.equal(result.status, 'processed');
  assert.ok(result.requestId);

  const inserts = calls.filter((c) => /INSERT INTO shopify_compliance_requests/i.test(c.query));
  assert.equal(inserts.length, 1, 'doit enregistrer la requête une seule fois');

  const updates = calls.filter((c) => /UPDATE shopify_compliance_requests/i.test(c.query));
  assert.equal(updates.length, 1);
  assert.equal(updates[0].args[1], 'processed');
  assert.equal(updates[0].args[2], null);
});

test('processComplianceWebhook marque error et propage si le handler échoue', async () => {
  const { prisma, calls } = createPrismaMock();
  // Force le handler shop/redact à planter en omettant shopDomain
  await assert.rejects(
    () =>
      processComplianceWebhook({
        prisma,
        topic: COMPLIANCE_TOPICS.SHOP_REDACT,
        shopDomain: '',
        payload: {},
        notifyAdmin: async () => null,
      }),
    /shopDomain manquant/i
  );

  const updates = calls.filter((c) => /UPDATE shopify_compliance_requests/i.test(c.query));
  assert.equal(updates.length, 1, 'doit quand même marquer la requête (error)');
  assert.equal(updates[0].args[1], 'error');
  assert.ok(updates[0].args[2], 'doit stocker un message d\'erreur');
});

test('handleShopRedact retourne 0 si aucune boutique ne matche', async () => {
  const { prisma } = createPrismaMock({ credentialIds: [] });
  const summary = await handleShopRedact({
    prisma,
    shopDomain: 'inconnu.myshopify.com',
    payload: {},
  });
  assert.deepEqual(summary, {
    credentialsRemoved: 0,
    sourcesRemoved: 0,
    feedsRemoved: 0,
    itemsRemoved: 0,
  });
});

test('handleShopRedact cascade Credential → FeedSource → Feed → FeedItem', async () => {
  const { prisma, calls } = createPrismaMock({
    credentialIds: ['cred-1'],
    sourceIds: ['src-1'],
    feedIds: ['feed-1', 'feed-2'],
  });

  const summary = await handleShopRedact({
    prisma,
    shopDomain: 'demo-shop.myshopify.com',
    payload: { shop_domain: 'demo-shop.myshopify.com' },
  });

  assert.equal(summary.credentialsRemoved, 1);
  assert.equal(summary.sourcesRemoved, 1);
  assert.equal(summary.feedsRemoved, 2);
  assert.equal(summary.itemsRemoved, 42);

  // Vérifie l'ordre de suppression : items d'abord, credentials en dernier
  const deleteOps = calls
    .filter((c) => c.kind === 'execute' && /^DELETE FROM/i.test(c.query.trim()))
    .map((c) => c.query.match(/DELETE FROM "(\w+)"/)?.[1]);
  const itemIdx = deleteOps.indexOf('FeedItem');
  const feedIdx = deleteOps.indexOf('Feed');
  const sourceIdx = deleteOps.indexOf('FeedSource');
  const credIdx = deleteOps.indexOf('Credential');
  assert.ok(itemIdx >= 0 && feedIdx > itemIdx, 'FeedItem doit être supprimé avant Feed');
  assert.ok(sourceIdx > feedIdx, 'Feed doit être supprimé avant FeedSource');
  assert.ok(credIdx > sourceIdx, 'FeedSource doit être supprimé avant Credential');
});

test('handleShopRedact appelle notifyAdmin avec un résumé', async () => {
  const { prisma } = createPrismaMock({
    credentialIds: ['cred-1'],
    sourceIds: ['src-1'],
    feedIds: ['feed-1'],
  });
  const notifyCalls = [];
  await handleShopRedact({
    prisma,
    shopDomain: 'demo-shop.myshopify.com',
    payload: {},
    notifyAdmin: async (msg) => {
      notifyCalls.push(msg);
      return null;
    },
  });
  assert.equal(notifyCalls.length, 1);
  assert.match(notifyCalls[0].subject, /shop\/redact.*demo-shop\.myshopify\.com/);
  assert.match(notifyCalls[0].body, /credentialsRemoved/);
});
