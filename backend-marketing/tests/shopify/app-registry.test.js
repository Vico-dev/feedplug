const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildShopifyApps,
  resolveShopifyApp,
} = require('../../domains/shopify/app-registry');

const LISTED_ENV = {
  SHOPIFY_API_KEY: 'listed-key',
  SHOPIFY_API_SECRET: 'listed-secret',
  SHOPIFY_CALLBACK_URL: 'https://api.feedplug.com/cb',
  SHOPIFY_SCOPES: 'read_products,read_orders',
};

// ──────────────────────────────────────────────────────────────────────────
// buildShopifyApps
// ──────────────────────────────────────────────────────────────────────────

test('buildShopifyApps : sans env connecteur → seule l app listée existe', () => {
  const apps = buildShopifyApps(LISTED_ENV);
  assert.ok(apps.listed, 'listed doit exister');
  assert.equal(apps.connector, undefined, 'connector absent si env non fourni');
  assert.equal(apps.listed.appId, 'listed');
  assert.equal(apps.listed.apiKey, 'listed-key');
  assert.equal(apps.listed.apiSecret, 'listed-secret');
  assert.equal(apps.listed.embedded, true);
  assert.equal(apps.listed.billing, true);
  assert.equal(apps.listed.billingProvider, 'SHOPIFY');
  assert.equal(apps.listed.webhookPath, '/api/v1/webhooks/shopify');
});

test('buildShopifyApps : avec env connecteur → app connecteur ajoutée', () => {
  const apps = buildShopifyApps({
    ...LISTED_ENV,
    SHOPIFY_CONNECTOR_API_KEY: 'conn-key',
    SHOPIFY_CONNECTOR_API_SECRET: 'conn-secret',
  });
  assert.ok(apps.connector, 'connector doit exister');
  assert.equal(apps.connector.appId, 'connector');
  assert.equal(apps.connector.apiKey, 'conn-key');
  assert.equal(apps.connector.apiSecret, 'conn-secret');
  assert.equal(apps.connector.embedded, false, 'connecteur non embedded');
  assert.equal(apps.connector.billing, false, 'connecteur sans billing');
  assert.equal(apps.connector.billingProvider, 'STRIPE');
  assert.equal(apps.connector.webhookPath, '/api/v1/webhooks/shopify/connector');
  assert.equal(apps.connector.scopes, 'read_products', 'scopes connecteur par défaut');
});

test('buildShopifyApps : connecteur exige LES DEUX clés (key seule → absent)', () => {
  const apps = buildShopifyApps({
    ...LISTED_ENV,
    SHOPIFY_CONNECTOR_API_KEY: 'conn-key',
    // pas de secret
  });
  assert.equal(apps.connector, undefined, 'connector absent si secret manquant');
});

test('buildShopifyApps : callback connecteur tombe sur celui de listed si non fourni', () => {
  const apps = buildShopifyApps({
    ...LISTED_ENV,
    SHOPIFY_CONNECTOR_API_KEY: 'conn-key',
    SHOPIFY_CONNECTOR_API_SECRET: 'conn-secret',
  });
  assert.equal(apps.connector.callbackUrl, 'https://api.feedplug.com/cb');
});

// ──────────────────────────────────────────────────────────────────────────
// resolveShopifyApp
// ──────────────────────────────────────────────────────────────────────────

test('resolveShopifyApp : "connector" renvoie le connecteur quand présent', () => {
  const apps = buildShopifyApps({
    ...LISTED_ENV,
    SHOPIFY_CONNECTOR_API_KEY: 'conn-key',
    SHOPIFY_CONNECTOR_API_SECRET: 'conn-secret',
  });
  assert.equal(resolveShopifyApp(apps, 'connector').appId, 'connector');
});

test('resolveShopifyApp : fallback listed pour appId inconnu / absent / connecteur non configuré', () => {
  const withConnector = buildShopifyApps({
    ...LISTED_ENV,
    SHOPIFY_CONNECTOR_API_KEY: 'conn-key',
    SHOPIFY_CONNECTOR_API_SECRET: 'conn-secret',
  });
  assert.equal(resolveShopifyApp(withConnector, undefined).appId, 'listed', 'undefined → listed (states legacy)');
  assert.equal(resolveShopifyApp(withConnector, 'bogus').appId, 'listed', 'inconnu → listed');
  assert.equal(resolveShopifyApp(withConnector, 'listed').appId, 'listed');

  const listedOnly = buildShopifyApps(LISTED_ENV);
  assert.equal(resolveShopifyApp(listedOnly, 'connector').appId, 'listed', 'connecteur demandé mais non configuré → listed');
});
