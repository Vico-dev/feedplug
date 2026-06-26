'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_GMC_CATEGORY,
  normalizeAvailabilityForGMC,
  normalizeConditionForGMC,
  parseGmcMerchantOptions,
  resolveGmcOfferId,
  buildGmcProductEntry,
  createGmcPush,
} = require('../../domains/gmc/push');

// ---------------------------------------------------------------------------
// normalizeAvailabilityForGMC
// ---------------------------------------------------------------------------
test('normalizeAvailabilityForGMC keeps canonical GMC values', () => {
  assert.equal(normalizeAvailabilityForGMC('in_stock', null), 'in_stock');
  assert.equal(normalizeAvailabilityForGMC('preorder', null), 'preorder');
  assert.equal(normalizeAvailabilityForGMC('backorder', null), 'backorder');
});

test('normalizeAvailabilityForGMC maps free-text synonyms', () => {
  assert.equal(normalizeAvailabilityForGMC('Pre-Order soon', null), 'preorder');
  assert.equal(normalizeAvailabilityForGMC('on back-order', null), 'backorder');
  assert.equal(normalizeAvailabilityForGMC('In Stock now', null), 'in_stock');
  assert.equal(normalizeAvailabilityForGMC('instock', null), 'in_stock');
});

test('normalizeAvailabilityForGMC falls back on inventory then out_of_stock', () => {
  assert.equal(normalizeAvailabilityForGMC(null, 5), 'in_stock');
  assert.equal(normalizeAvailabilityForGMC(null, '3'), 'in_stock');
  assert.equal(normalizeAvailabilityForGMC(null, 0), 'out_of_stock');
  assert.equal(normalizeAvailabilityForGMC(null, null), 'out_of_stock');
  assert.equal(normalizeAvailabilityForGMC('whatever', null), 'out_of_stock');
});

// ---------------------------------------------------------------------------
// normalizeConditionForGMC
// ---------------------------------------------------------------------------
test('normalizeConditionForGMC keeps canonical values and defaults to new', () => {
  assert.equal(normalizeConditionForGMC('used'), 'used');
  assert.equal(normalizeConditionForGMC('refurbished'), 'refurbished');
  assert.equal(normalizeConditionForGMC('new'), 'new');
  assert.equal(normalizeConditionForGMC(''), 'new');
  assert.equal(normalizeConditionForGMC(null), 'new');
  assert.equal(normalizeConditionForGMC('unknown-stuff'), 'new');
});

test('normalizeConditionForGMC maps multilingual synonyms', () => {
  assert.equal(normalizeConditionForGMC('Neuf'), 'new');
  assert.equal(normalizeConditionForGMC('nuevo'), 'new');
  assert.equal(normalizeConditionForGMC('reconditionné'), 'refurbished');
  assert.equal(normalizeConditionForGMC('occasion'), 'used');
  assert.equal(normalizeConditionForGMC('second hand'), 'used');
});

// ---------------------------------------------------------------------------
// parseGmcMerchantOptions
// ---------------------------------------------------------------------------
test('parseGmcMerchantOptions dedupes and labels merchant entries', () => {
  const out = parseGmcMerchantOptions({
    accountIdentifiers: [
      { merchantId: '123', name: 'Boutique A' },
      { merchantId: '123', name: 'dup ignored' },
      { merchantId: '456' },
      // merchantId empty → falls back to aggregatorId (preserved behavior)
      { aggregatorId: '999', merchantId: '' },
    ],
  });
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], {
    merchantId: '123',
    merchantName: 'Boutique A',
    aggregatorId: '',
    label: 'Boutique A (123)',
  });
  // No name → fallback label
  assert.equal(out[1].merchantId, '456');
  assert.equal(out[1].label, 'Merchant Center 456');
  // merchantId empty → uses aggregatorId as id (fallback chain preserved)
  assert.equal(out[2].merchantId, '999');
  assert.equal(out[2].aggregatorId, '999');
});

test('parseGmcMerchantOptions returns [] for malformed input', () => {
  assert.deepEqual(parseGmcMerchantOptions(null), []);
  assert.deepEqual(parseGmcMerchantOptions({}), []);
  assert.deepEqual(parseGmcMerchantOptions({ accountIdentifiers: 'nope' }), []);
});

// ---------------------------------------------------------------------------
// resolveGmcOfferId — ≤50 propre / fallback id FeedItem
// ---------------------------------------------------------------------------
test('resolveGmcOfferId uses clean originid when ≤50 chars', () => {
  assert.equal(resolveGmcOfferId({ originid: 'SKU-123', id: 'uuid-aaa' }), 'SKU-123');
  assert.equal(resolveGmcOfferId({ originId: 'SKU-CAMEL', id: 'uuid-aaa' }), 'SKU-CAMEL');
});

test('resolveGmcOfferId falls back to FeedItem id when originid >50 chars', () => {
  const longOrigin = 'X'.repeat(80);
  const out = resolveGmcOfferId({ originid: longOrigin, id: 'feeditem-uuid-36-chars-aaaaaaaaaaaa' });
  assert.equal(out, 'feeditem-uuid-36-chars-aaaaaaaaaaaa');
});

test('resolveGmcOfferId falls back to id when originid empty, and caps at 50', () => {
  assert.equal(resolveGmcOfferId({ originid: '', id: 'fallback-id' }), 'fallback-id');
  const id60 = 'Y'.repeat(60);
  assert.equal(resolveGmcOfferId({ originid: '', id: id60 }).length, 50);
});

// ---------------------------------------------------------------------------
// buildGmcProductEntry — construction du payload batch
// ---------------------------------------------------------------------------
function stubGetOptimized(item) {
  return { title: item.title, description: item.descriptionText || '' };
}

test('buildGmcProductEntry builds a well-formed batch entry', () => {
  const item = {
    id: 'feed-uuid',
    originid: 'SKU-42',
    title: 'Robe rouge',
    descriptionText: '<b>Belle</b> robe',
    url: 'https://shop/p/42',
    imageurl: 'https://img/42.jpg',
    brand: 'ACME',
    sku: 'SKU-42',
    price: 19.9,
    currency: 'EUR',
    inventory: 7,
    gtin: '0123456789012',
    mpn: 'MPN-42',
    customfields: { google_product_category: 'Apparel > Dresses', condition: 'neuf' },
  };
  const entry = buildGmcProductEntry(item, 3, {
    merchantId: 'M-1',
    contentLanguage: 'fr',
    targetCountry: 'FR',
    getOptimizedContentForPlatform: stubGetOptimized,
  });

  assert.equal(entry.batchId, 3);
  assert.equal(entry.merchantId, 'M-1');
  assert.equal(entry.method, 'insert');
  assert.equal(entry.product.offerId, 'SKU-42');
  assert.equal(entry.product.title, 'Robe rouge');
  assert.equal(entry.product.description, 'Belle robe'); // HTML stripped
  assert.deepEqual(entry.product.price, { value: '19.90', currency: 'EUR' });
  assert.equal(entry.product.availability, 'in_stock'); // inventory > 0
  assert.equal(entry.product.condition, 'new'); // "neuf"
  assert.equal(entry.product.googleProductCategory, 'Apparel > Dresses');
  assert.equal(entry.product.channel, 'online');
  assert.equal(entry.product.contentLanguage, 'fr');
  assert.equal(entry.product.targetCountry, 'FR');
});

test('buildGmcProductEntry defaults category and currency, omits price when absent', () => {
  const item = { id: 'id1', title: 'T', customfields: null };
  const entry = buildGmcProductEntry(item, 0, {
    merchantId: 'M',
    contentLanguage: 'en',
    targetCountry: 'GB',
    currencyCode: 'GBP',
    getOptimizedContentForPlatform: stubGetOptimized,
  });
  assert.equal(entry.product.googleProductCategory, DEFAULT_GMC_CATEGORY);
  assert.equal(entry.product.price, undefined); // no price field
  assert.equal(entry.product.availability, 'out_of_stock');
  assert.equal(entry.product.offerId, 'id1');
});

test('buildGmcProductEntry uses destination currency fallback when item has none', () => {
  const item = { id: 'id1', title: 'T', price: 5, customfields: {} };
  const entry = buildGmcProductEntry(item, 0, {
    merchantId: 'M',
    contentLanguage: 'es',
    targetCountry: 'ES',
    currencyCode: 'USD',
    getOptimizedContentForPlatform: stubGetOptimized,
  });
  assert.deepEqual(entry.product.price, { value: '5.00', currency: 'USD' });
});

// ---------------------------------------------------------------------------
// createGmcPush.executeGmcPush — chemin nominal via stubs (pas de réseau réel)
// ---------------------------------------------------------------------------
function makeDeps(overrides = {}) {
  const fetchCalls = [];
  const prisma = {
    queries: [],
    async $queryRawUnsafe(sql, ...args) {
      this.queries.push({ sql, args });
      // 1er appel = SELECT FeedItem
      return overrides.items || [
        { id: 'i1', originid: 'O1', title: 'P1', price: 10, currency: 'EUR', inventory: 1, customfields: {} },
      ];
    },
    async $executeRawUnsafe(sql, ...args) {
      this.queries.push({ sql, args, write: true });
      return 1;
    },
  };
  const deps = {
    getPrisma: () => prisma,
    fetch: async (url, opts) => {
      fetchCalls.push({ url, opts });
      return {
        ok: true,
        status: 200,
        async json() {
          // 1 entry succeeded
          return { entries: [{ batchId: 0 }] };
        },
        async text() { return ''; },
      };
    },
    crypto: { randomUUID: () => 'log-uuid-1' },
    getActivePlatformConnectionForPush: async () => ({ id: 'conn1', merchantid: 'M-123', accesstoken: 'tok', tokenexpiry: null }),
    refreshGMCToken: async () => 'tok2',
    filterItemsForDestinationActivation: async (items) => items,
    getOptimizedContentForPlatform: stubGetOptimized,
    translateItemsForDestination: async (_p, items) => ({ items, stats: { skipped: true } }),
    findUserById: async () => null,
    sendExportCompleteEmail: async () => {},
    buildDestinationPushLabel: () => null,
    createPushError: (message, statusCode = 400, extras = {}) => {
      const e = new Error(message);
      e.statusCode = statusCode;
      Object.assign(e, extras);
      return e;
    },
    ...overrides.deps,
  };
  return { deps, prisma, fetchCalls };
}

test('executeGmcPush pushes a batch and logs success', async () => {
  const { deps, fetchCalls, prisma } = makeDeps();
  const { executeGmcPush } = createGmcPush(deps);
  const res = await executeGmcPush({ accountId: 'acc1', userId: 'u1', feedId: 'feed1' });

  assert.equal(res.succeeded, 1);
  assert.equal(res.failed, 0);
  assert.equal(res.total, 1);
  assert.equal(res.logId, 'log-uuid-1');
  // batch endpoint hit once
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /products\/batch$/);
  // ExportLog written
  assert.ok(prisma.queries.some(q => q.write && /INSERT INTO "ExportLog"/.test(q.sql)));
});

test('executeGmcPush throws createPushError when GMC not connected', async () => {
  const { deps } = makeDeps({ deps: { getActivePlatformConnectionForPush: async () => null } });
  const { executeGmcPush } = createGmcPush(deps);
  await assert.rejects(
    () => executeGmcPush({ accountId: 'acc1', userId: 'u1', feedId: 'feed1' }),
    (err) => err.statusCode === 400 && /non connecté/i.test(err.message)
  );
});

test('executeGmcPush returns empty result when no items', async () => {
  const { deps } = makeDeps({ items: [] });
  const { executeGmcPush } = createGmcPush(deps);
  const res = await executeGmcPush({ accountId: 'acc1', userId: 'u1', feedId: 'feed1' });
  assert.equal(res.total, 0);
  assert.equal(res.succeeded, 0);
  assert.equal(res.message, 'Aucun produit à pousser');
});
