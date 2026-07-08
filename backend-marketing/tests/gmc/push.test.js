'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_GMC_CATEGORY,
  normalizeAvailabilityForGMC,
  normalizeConditionForGMC,
  toMerchantAvailability,
  toMerchantCondition,
  priceToAmountMicros,
  parseGmcMerchantOptions,
  resolveGmcOfferId,
  buildProductInput,
  createGmcPush,
} = require('../../domains/gmc/push');

// ---------------------------------------------------------------------------
// normalizeAvailabilityForGMC (valeurs v2.1 minuscules — réutilisées Amazon/Meta)
// ---------------------------------------------------------------------------
test('normalizeAvailabilityForGMC keeps canonical v2.1 values', () => {
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
// Mapping vers les enums Merchant API + prix en micros
// ---------------------------------------------------------------------------
test('toMerchantAvailability uppercases v2.1 values to Merchant API enum', () => {
  assert.equal(toMerchantAvailability('in_stock'), 'IN_STOCK');
  assert.equal(toMerchantAvailability('out_of_stock'), 'OUT_OF_STOCK');
  assert.equal(toMerchantAvailability('preorder'), 'PREORDER');
  assert.equal(toMerchantAvailability('backorder'), 'BACKORDER');
  assert.equal(toMerchantAvailability(null), 'OUT_OF_STOCK');
});

test('toMerchantCondition uppercases v2.1 values to Merchant API enum', () => {
  assert.equal(toMerchantCondition('new'), 'NEW');
  assert.equal(toMerchantCondition('refurbished'), 'REFURBISHED');
  assert.equal(toMerchantCondition('used'), 'USED');
  assert.equal(toMerchantCondition(null), 'NEW');
});

test('priceToAmountMicros converts to integer micros string, null when absent', () => {
  assert.equal(priceToAmountMicros(19.99), '19990000');
  assert.equal(priceToAmountMicros('5'), '5000000');
  assert.equal(priceToAmountMicros(0), '0');
  assert.equal(priceToAmountMicros(null), null);
  assert.equal(priceToAmountMicros(''), null);
  assert.equal(priceToAmountMicros('abc'), null);
});

// ---------------------------------------------------------------------------
// parseGmcMerchantOptions — désormais nourri par accounts.list (Merchant API)
// ---------------------------------------------------------------------------
test('parseGmcMerchantOptions parses accounts.list, dedupes and labels', () => {
  const out = parseGmcMerchantOptions({
    accounts: [
      { name: 'accounts/123', accountName: 'Boutique A' },
      { name: 'accounts/123', accountName: 'dup ignored' },
      { name: 'accounts/456' }, // pas de accountName → fallback label
    ],
  });
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    merchantId: '123',
    merchantName: 'Boutique A',
    aggregatorId: '',
    label: 'Boutique A (123)',
  });
  assert.equal(out[1].merchantId, '456');
  assert.equal(out[1].merchantName, '');
  assert.equal(out[1].label, 'Merchant Center 456');
});

test('parseGmcMerchantOptions returns [] for malformed input', () => {
  assert.deepEqual(parseGmcMerchantOptions(null), []);
  assert.deepEqual(parseGmcMerchantOptions({}), []);
  assert.deepEqual(parseGmcMerchantOptions({ accounts: 'nope' }), []);
});

// ---------------------------------------------------------------------------
// resolveGmcOfferId — inchangé
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
// buildProductInput — corps ProductInput Merchant API
// ---------------------------------------------------------------------------
function stubGetOptimized(item) {
  return { title: item.title, description: item.descriptionText || '' };
}

test('buildProductInput builds a well-formed Merchant API ProductInput', () => {
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
  const pi = buildProductInput(item, {
    contentLanguage: 'fr',
    feedLabel: 'FR',
    getOptimizedContentForPlatform: stubGetOptimized,
  });

  assert.equal(pi.offerId, 'SKU-42');
  assert.equal(pi.contentLanguage, 'fr');
  assert.equal(pi.feedLabel, 'FR');
  const a = pi.productAttributes;
  assert.equal(a.title, 'Robe rouge');
  assert.equal(a.description, 'Belle robe'); // HTML stripped
  assert.equal(a.link, 'https://shop/p/42');
  assert.equal(a.imageLink, 'https://img/42.jpg');
  assert.deepEqual(a.price, { amountMicros: '19900000', currencyCode: 'EUR' });
  assert.equal(a.availability, 'IN_STOCK'); // inventory > 0, uppercased
  assert.equal(a.condition, 'NEW'); // "neuf"
  assert.deepEqual(a.gtins, ['0123456789012']); // plural array
  assert.equal(a.mpn, 'MPN-42');
  assert.equal(a.googleProductCategory, 'Apparel > Dresses');
  // plus de champ v2.1 : ni channel, ni targetCountry, ni price.value
  assert.equal(a.channel, undefined);
  assert.equal(a.targetCountry, undefined);
});

test('buildProductInput defaults category, omits price/gtins/mpn when absent', () => {
  const item = { id: 'id1', title: 'T', customfields: null };
  const pi = buildProductInput(item, {
    contentLanguage: 'en',
    feedLabel: 'GB',
    currencyCode: 'GBP',
    getOptimizedContentForPlatform: stubGetOptimized,
  });
  assert.equal(pi.productAttributes.googleProductCategory, DEFAULT_GMC_CATEGORY);
  assert.equal(pi.productAttributes.price, undefined);
  assert.equal(pi.productAttributes.gtins, undefined);
  assert.equal(pi.productAttributes.mpn, undefined);
  assert.equal(pi.productAttributes.availability, 'OUT_OF_STOCK');
  assert.equal(pi.offerId, 'id1');
});

test('buildProductInput uses destination currency fallback when item has none', () => {
  const item = { id: 'id1', title: 'T', price: 5, customfields: {} };
  const pi = buildProductInput(item, {
    contentLanguage: 'es',
    feedLabel: 'ES',
    currencyCode: 'USD',
    getOptimizedContentForPlatform: stubGetOptimized,
  });
  assert.deepEqual(pi.productAttributes.price, { amountMicros: '5000000', currencyCode: 'USD' });
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
      return overrides.items || [
        { id: 'i1', originid: 'O1', title: 'P1', price: 10, currency: 'EUR', inventory: 1, customfields: {} },
      ];
    },
    async $executeRawUnsafe(sql, ...args) {
      this.queries.push({ sql, args, write: true });
      return 1;
    },
  };
  // Stub fetch routé par URL : dataSources.list → une source API primaire ;
  // productInputs:insert → 200.
  const defaultFetch = async (url, opts) => {
    fetchCalls.push({ url, opts });
    if (/\/dataSources$/.test(url) && (!opts || opts.method !== 'POST')) {
      return {
        ok: true, status: 200,
        async json() {
          return { dataSources: [{ name: 'accounts/M-123/dataSources/ds-1', input: 'API', primaryProductDataSourceInput: {} }] };
        },
        async text() { return ''; },
      };
    }
    if (/productInputs:insert/.test(url)) {
      return { ok: true, status: 200, async json() { return { name: 'accounts/M-123/products/x' }; }, async text() { return ''; } };
    }
    return { ok: true, status: 200, async json() { return {}; }, async text() { return ''; } };
  };
  const deps = {
    getPrisma: () => prisma,
    fetch: overrides.fetch || defaultFetch,
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

test('executeGmcPush inserts each product via productInputs.insert and logs success', async () => {
  const { deps, fetchCalls, prisma } = makeDeps({
    items: [
      { id: 'i1', originid: 'O1', title: 'P1', price: 10, currency: 'EUR', inventory: 1, customfields: {} },
      { id: 'i2', originid: 'O2', title: 'P2', price: 20, currency: 'EUR', inventory: 0, customfields: {} },
    ],
  });
  const { executeGmcPush } = createGmcPush(deps);
  const res = await executeGmcPush({ accountId: 'acc1', userId: 'u1', feedId: 'feed1' });

  assert.equal(res.succeeded, 2);
  assert.equal(res.failed, 0);
  assert.equal(res.total, 2);
  assert.equal(res.logId, 'log-uuid-1');
  // dataSource résolu une fois, puis un insert par produit.
  const inserts = fetchCalls.filter(c => /productInputs:insert/.test(c.url));
  assert.equal(inserts.length, 2);
  assert.match(inserts[0].url, /merchantapi\.googleapis\.com\/products\/v1\/accounts\/M-123\/productInputs:insert\?dataSource=/);
  assert.ok(fetchCalls.some(c => /\/datasources\/v1\/accounts\/M-123\/dataSources$/.test(c.url)));
  // ExportLog écrit
  assert.ok(prisma.queries.some(q => q.write && /INSERT INTO "ExportLog"/.test(q.sql)));
});

test('executeGmcPush counts per-product failures', async () => {
  let n = 0;
  const fetch = async (url, opts) => {
    if (/\/dataSources$/.test(url) && (!opts || opts.method !== 'POST')) {
      return { ok: true, status: 200, async json() { return { dataSources: [{ name: 'accounts/M-123/dataSources/ds-1', input: 'API', primaryProductDataSourceInput: {} }] }; }, async text() { return ''; } };
    }
    if (/productInputs:insert/.test(url)) {
      n++;
      if (n === 2) return { ok: false, status: 400, async text() { return 'invalid attribute'; } };
      return { ok: true, status: 200, async json() { return {}; }, async text() { return ''; } };
    }
    return { ok: true, status: 200, async json() { return {}; }, async text() { return ''; } };
  };
  const { deps } = makeDeps({
    fetch,
    items: [
      { id: 'i1', title: 'P1', price: 1, customfields: {} },
      { id: 'i2', title: 'P2', price: 2, customfields: {} },
      { id: 'i3', title: 'P3', price: 3, customfields: {} },
    ],
  });
  const { executeGmcPush } = createGmcPush(deps);
  const res = await executeGmcPush({ accountId: 'acc1', userId: 'u1', feedId: 'feed1' });
  assert.equal(res.total, 3);
  assert.equal(res.succeeded, 2);
  assert.equal(res.failed, 1);
  assert.equal(res.errors.length, 1);
});

test('executeGmcPush marks connection expired and throws on 401', async () => {
  const fetch = async (url, opts) => {
    if (/\/dataSources$/.test(url) && (!opts || opts.method !== 'POST')) {
      return { ok: true, status: 200, async json() { return { dataSources: [{ name: 'accounts/M-123/dataSources/ds-1', input: 'API', primaryProductDataSourceInput: {} }] }; }, async text() { return ''; } };
    }
    if (/productInputs:insert/.test(url)) {
      return { ok: false, status: 401, async text() { return 'unauthorized'; } };
    }
    return { ok: true, status: 200, async json() { return {}; }, async text() { return ''; } };
  };
  const { deps, prisma } = makeDeps({ fetch });
  const { executeGmcPush } = createGmcPush(deps);
  await assert.rejects(
    () => executeGmcPush({ accountId: 'acc1', userId: 'u1', feedId: 'feed1' }),
    (err) => err.statusCode === 401 && err.reconnect === true
  );
  assert.ok(prisma.queries.some(q => q.write && /status = 'expired'/.test(q.sql)));
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
