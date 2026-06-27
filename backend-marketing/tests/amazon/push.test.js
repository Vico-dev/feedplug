'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AMAZON_CHANNEL_CONFIG,
  normalizeConditionForAmazon,
  normalizeForAmazon,
  createAmazonPush,
} = require('../../domains/amazon/push');

// ---------------------------------------------------------------------------
// AMAZON_CHANNEL_CONFIG
// ---------------------------------------------------------------------------
test('AMAZON_CHANNEL_CONFIG exposes the 5 EU marketplaces with stable ids', () => {
  assert.deepEqual(Object.keys(AMAZON_CHANNEL_CONFIG).sort(), [
    'amazon_de', 'amazon_es', 'amazon_fr', 'amazon_it', 'amazon_uk',
  ]);
  assert.equal(AMAZON_CHANNEL_CONFIG.amazon_fr.marketplaceId, 'A13V1IB3VIYzH9');
  assert.equal(AMAZON_CHANNEL_CONFIG.amazon_uk.currency, 'GBP');
  assert.equal(AMAZON_CHANNEL_CONFIG.amazon_de.currency, 'EUR');
});

// ---------------------------------------------------------------------------
// normalizeConditionForAmazon
// ---------------------------------------------------------------------------
test('normalizeConditionForAmazon maps to capitalized SP-API values', () => {
  assert.equal(normalizeConditionForAmazon('refurbished'), 'Refurbished');
  assert.equal(normalizeConditionForAmazon('Refurbished'), 'Refurbished');
  assert.equal(normalizeConditionForAmazon('used'), 'Used');
  assert.equal(normalizeConditionForAmazon('new'), 'New');
  assert.equal(normalizeConditionForAmazon(''), 'New');
  assert.equal(normalizeConditionForAmazon(null), 'New');
  assert.equal(normalizeConditionForAmazon('unknown-value'), 'New');
});

// ---------------------------------------------------------------------------
// normalizeForAmazon — truncations, fallbacks, external id type
// ---------------------------------------------------------------------------
test('normalizeForAmazon builds SP-API attributes with truncations and fallbacks', () => {
  const item = {
    id: 'feed-item-uuid',
    sku: 'SKU-1',
    title: 'A nice product',
    brand: 'Acme',
    price: 19.9,
    inventory: 7,
    gtin: '0123456789012',
    customfields: {},
  };
  const n = normalizeForAmazon(item, AMAZON_CHANNEL_CONFIG.amazon_fr);
  assert.equal(n.sku, 'SKU-1');
  assert.equal(n.item_name, 'A nice product');
  assert.equal(n.brand, 'Acme');
  assert.equal(n.standard_price, '19.90 EUR');
  assert.equal(n.quantity, 7);
  assert.equal(n.condition_type, 'New');
  assert.equal(n.external_product_id, '0123456789012');
  assert.equal(n.external_product_id_type, 'ean');
});

test('normalizeForAmazon falls back to mpn (upc) then empty when no gtin', () => {
  const withMpn = normalizeForAmazon(
    { id: 'x', sku: 'S', title: 'T', mpn: 'MPN-9', customfields: {} },
    AMAZON_CHANNEL_CONFIG.amazon_de
  );
  assert.equal(withMpn.external_product_id, 'MPN-9');
  assert.equal(withMpn.external_product_id_type, 'upc');

  const noIds = normalizeForAmazon(
    { id: 'x', title: 'T', customfields: {} },
    AMAZON_CHANNEL_CONFIG.amazon_de
  );
  // no sku/gtin/mpn → sku falls back to id, external id empty
  assert.equal(noIds.external_product_id, '');
  assert.equal(noIds.external_product_id_type, '');
  assert.equal(noIds.brand, 'Generic');
});

test('normalizeForAmazon truncates item_name to 200 and uses channel currency', () => {
  const longTitle = 'x'.repeat(300);
  const n = normalizeForAmazon(
    { id: 'x', sku: 'S', title: longTitle, price: 5, customfields: {} },
    AMAZON_CHANNEL_CONFIG.amazon_uk
  );
  assert.equal(n.item_name.length, 200);
  assert.equal(n.standard_price, '5.00 GBP');
});

// ---------------------------------------------------------------------------
// createAmazonPush — DI wiring + behaviour (no real network/db)
// ---------------------------------------------------------------------------
function makeError(message, statusCode = 400, extras = {}) {
  const e = new Error(message);
  e.statusCode = statusCode;
  Object.assign(e, extras);
  return e;
}

test('executeAmazonPush rejects an unknown channel key with createPushError', async () => {
  const { executeAmazonPush } = createAmazonPush({
    getPrisma: () => ({}),
    fetch: async () => { throw new Error('should not be called'); },
    crypto: { randomUUID: () => 'id' },
    AMAZON_SP_API_BASE: 'https://example.test',
    getActivePlatformConnectionForPush: async () => ({}),
    refreshAmazonToken: async () => 'tok',
    filterItemsForDestinationActivation: async (i) => i,
    inferAmazonChannelKeyForMarket: () => '',
    translateItemsForDestination: async (_p, i) => ({ items: i, stats: { skipped: true } }),
    buildDestinationPushLabel: () => '',
    createPushError: makeError,
  });

  await assert.rejects(
    () => executeAmazonPush({ accountId: 'a', feedId: 'f', channelKey: 'amazon_zz' }),
    (err) => err.statusCode === 400 && /Canal Amazon invalide/.test(err.message)
  );
});

test('executeAmazonPush returns empty-feed state without calling SP-API', async () => {
  let fetchCalled = false;
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (/COUNT\(\*\)/.test(sql)) return [{ total: 0, amazon_disabled: 0 }];
      return []; // FeedItem select → no items
    },
    $executeRawUnsafe: async () => {},
  };
  const { executeAmazonPush } = createAmazonPush({
    getPrisma: () => prisma,
    fetch: async () => { fetchCalled = true; return { ok: true }; },
    crypto: { randomUUID: () => 'log-id' },
    AMAZON_SP_API_BASE: 'https://example.test',
    getActivePlatformConnectionForPush: async () => ({ accesstoken: 't', merchantid: 'SELLER' }),
    refreshAmazonToken: async () => 't',
    filterItemsForDestinationActivation: async (i) => i,
    inferAmazonChannelKeyForMarket: () => 'amazon_fr',
    translateItemsForDestination: async (_p, i) => ({ items: i, stats: { skipped: true } }),
    buildDestinationPushLabel: () => '',
    createPushError: makeError,
  });

  const res = await executeAmazonPush({ accountId: 'a', feedId: 'f' });
  assert.equal(res.total, 0);
  assert.equal(res.succeeded, 0);
  assert.equal(res.reason, 'empty_feed');
  assert.equal(res.channelKey, 'amazon_fr');
  assert.equal(fetchCalled, false);
});

test('executeAmazonPush pushes items and tallies succeeded/failed', async () => {
  const items = [
    { id: '1', sku: 'A', title: 'T1', price: 10, inventory: 1, customfields: {} },
    { id: '2', sku: 'B', title: 'T2', price: 20, inventory: 2, customfields: {} },
  ];
  let exportLogged = false;
  const prisma = {
    $queryRawUnsafe: async (sql) => (/COUNT\(\*\)/.test(sql) ? [{ total: 2, amazon_disabled: 0 }] : items),
    $executeRawUnsafe: async (sql) => { if (/ExportLog/.test(sql)) exportLogged = true; },
  };
  let putCount = 0;
  const { executeAmazonPush } = createAmazonPush({
    getPrisma: () => prisma,
    fetch: async () => {
      putCount++;
      return putCount === 1 ? { ok: true } : { ok: false, status: 422, text: async () => 'bad' };
    },
    crypto: { randomUUID: () => 'log-id' },
    AMAZON_SP_API_BASE: 'https://example.test',
    getActivePlatformConnectionForPush: async () => ({ accesstoken: 't', merchantid: 'SELLER' }),
    refreshAmazonToken: async () => 't',
    filterItemsForDestinationActivation: async (i) => i,
    inferAmazonChannelKeyForMarket: () => 'amazon_fr',
    translateItemsForDestination: async (_p, i) => ({ items: i, stats: { skipped: true } }),
    buildDestinationPushLabel: () => '',
    createPushError: makeError,
  });

  const res = await executeAmazonPush({ accountId: 'a', feedId: 'f', channelKey: 'amazon_fr' });
  assert.equal(res.total, 2);
  assert.equal(res.succeeded, 1);
  assert.equal(res.failed, 1);
  assert.equal(res.channelKey, 'amazon_fr');
  assert.equal(exportLogged, true);
});

test('executeAmazonPush throws reconnect error when all fail on auth', async () => {
  const items = [{ id: '1', sku: 'A', title: 'T1', price: 10, customfields: {} }];
  const prisma = {
    $queryRawUnsafe: async (sql) => (/COUNT\(\*\)/.test(sql) ? [{ total: 1, amazon_disabled: 0 }] : items),
    $executeRawUnsafe: async () => {},
  };
  const { executeAmazonPush } = createAmazonPush({
    getPrisma: () => prisma,
    fetch: async () => ({ ok: false, status: 401, text: async () => 'unauthorized' }),
    crypto: { randomUUID: () => 'log-id' },
    AMAZON_SP_API_BASE: 'https://example.test',
    getActivePlatformConnectionForPush: async () => ({ accesstoken: 't', merchantid: 'SELLER' }),
    refreshAmazonToken: async () => 't',
    filterItemsForDestinationActivation: async (i) => i,
    inferAmazonChannelKeyForMarket: () => 'amazon_fr',
    translateItemsForDestination: async (_p, i) => ({ items: i, stats: { skipped: true } }),
    buildDestinationPushLabel: () => '',
    createPushError: makeError,
  });

  await assert.rejects(
    () => executeAmazonPush({ accountId: 'a', feedId: 'f', channelKey: 'amazon_fr' }),
    (err) => err.statusCode === 401 && err.reconnect === true && /Reconnectez Seller Central/.test(err.message)
  );
});
