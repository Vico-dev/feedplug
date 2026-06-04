const test = require('node:test');
const assert = require('node:assert/strict');

const billing = require('../../domains/shopify/billing');

test('pickShopifyBillingCurrency garde EUR si shop EUR', () => {
  assert.equal(billing.pickShopifyBillingCurrency('EUR'), 'EUR');
});

test('pickShopifyBillingCurrency garde USD si shop USD', () => {
  assert.equal(billing.pickShopifyBillingCurrency('USD'), 'USD');
});

test('pickShopifyBillingCurrency fallback USD si devise non supportée', () => {
  // KRW n'est pas dans la whitelist Shopify Billing
  assert.equal(billing.pickShopifyBillingCurrency('KRW'), 'USD');
});

test('pickShopifyBillingCurrency fallback USD si devise vide ou inconnue', () => {
  assert.equal(billing.pickShopifyBillingCurrency(''), 'USD');
  assert.equal(billing.pickShopifyBillingCurrency('XYZ'), 'USD');
});

test('pickShopifyBillingCurrency fallback USD si supportée mais pas de taux EUR→devise', () => {
  // GBP est supportée mais on n'a pas de taux configuré par défaut
  delete process.env.SHOPIFY_BILLING_EUR_GBP_RATE;
  assert.equal(billing.pickShopifyBillingCurrency('GBP'), 'USD');
});

test('pickShopifyBillingCurrency garde la devise si taux configuré', () => {
  process.env.SHOPIFY_BILLING_EUR_GBP_RATE = '0.85';
  assert.equal(billing.pickShopifyBillingCurrency('GBP'), 'GBP');
  delete process.env.SHOPIFY_BILLING_EUR_GBP_RATE;
});

test('computeShopifyPrice EUR garde le montant inchangé', () => {
  const { amount, currency } = billing.computeShopifyPrice(79, 'EUR');
  assert.equal(currency, 'EUR');
  assert.equal(amount, 79);
});

test('computeShopifyPrice EUR→USD applique le taux par défaut 1.08', () => {
  delete process.env.SHOPIFY_BILLING_EUR_USD_RATE;
  const { amount, currency } = billing.computeShopifyPrice(100, 'USD');
  assert.equal(currency, 'USD');
  assert.equal(amount, 108);
});

test('computeShopifyPrice EUR→USD utilise le taux env si fourni', () => {
  process.env.SHOPIFY_BILLING_EUR_USD_RATE = '1.10';
  const { amount } = billing.computeShopifyPrice(100, 'USD');
  assert.equal(amount, 110);
  delete process.env.SHOPIFY_BILLING_EUR_USD_RATE;
});

test('computeShopifyPrice arrondit à 2 décimales', () => {
  delete process.env.SHOPIFY_BILLING_EUR_USD_RATE;
  const { amount } = billing.computeShopifyPrice(39, 'USD');
  // 39 * 1.08 = 42.12
  assert.equal(amount, 42.12);
});

test('isShopifyBillingTestMode = true hors production', () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  delete process.env.SHOPIFY_BILLING_FORCE_TEST;
  assert.equal(billing.isShopifyBillingTestMode(), true);
  process.env.NODE_ENV = original;
});

test('isShopifyBillingTestMode = false en production', () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.SHOPIFY_BILLING_FORCE_TEST;
  assert.equal(billing.isShopifyBillingTestMode(), false);
  process.env.NODE_ENV = original;
});

test('isShopifyBillingTestMode override SHOPIFY_BILLING_FORCE_TEST', () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.SHOPIFY_BILLING_FORCE_TEST = 'true';
  assert.equal(billing.isShopifyBillingTestMode(), true);
  process.env.SHOPIFY_BILLING_FORCE_TEST = '0';
  process.env.NODE_ENV = 'development';
  assert.equal(billing.isShopifyBillingTestMode(), false);
  delete process.env.SHOPIFY_BILLING_FORCE_TEST;
  process.env.NODE_ENV = original;
});

test('buildShopifyGraphqlEndpoint rejette les domaines non-myshopify (SSRF guard)', () => {
  const build = billing._internals.buildShopifyGraphqlEndpoint;
  assert.throws(() => build('attacker.com'), /Domaine Shopify invalide/);
  assert.throws(() => build('demo.myshopify.com.attacker.com'), /Domaine Shopify invalide/);
  assert.throws(() => build(''), /Domaine Shopify invalide/);
  assert.equal(
    build('demo-shop.myshopify.com'),
    'https://demo-shop.myshopify.com/admin/api/2026-01/graphql.json'
  );
});

test('createAppSubscription rejette si paramètre manquant', async () => {
  await assert.rejects(
    () => billing.createAppSubscription({}),
    /shop et accessToken requis/
  );
  await assert.rejects(
    () =>
      billing.createAppSubscription({
        shop: 'demo.myshopify.com',
        accessToken: 'tok',
        name: 'X',
        amount: 0,
        currency: 'USD',
        returnUrl: 'https://x.com',
      }),
    /amount\/currency\/returnUrl requis/i
  );
});

test('createAppSubscription appelle bien l\'API et retourne confirmationUrl', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          appSubscriptionCreate: {
            userErrors: [],
            confirmationUrl: 'https://demo.myshopify.com/admin/charges/12345/confirm',
            appSubscription: {
              id: 'gid://shopify/AppSubscription/12345',
              name: 'FeedPlug Pro',
              status: 'PENDING',
              test: true,
              trialDays: 0,
              createdAt: '2026-06-04T00:00:00Z',
              currentPeriodEnd: '2026-07-04T00:00:00Z',
            },
          },
        },
      }),
    };
  };

  const result = await billing.createAppSubscription({
    shop: 'demo.myshopify.com',
    accessToken: 'shpat_xxx',
    name: 'FeedPlug Pro',
    amount: 79.0,
    currency: 'USD',
    returnUrl: 'https://app.feedplug.com/return',
    trialDays: 14,
    test: true,
    fetchImpl,
  });

  assert.equal(result.subscriptionId, 'gid://shopify/AppSubscription/12345');
  assert.equal(result.confirmationUrl, 'https://demo.myshopify.com/admin/charges/12345/confirm');
  assert.equal(fetchCalls.length, 1);

  const sentBody = JSON.parse(fetchCalls[0].opts.body);
  assert.equal(sentBody.variables.name, 'FeedPlug Pro');
  assert.equal(sentBody.variables.trialDays, 14);
  assert.equal(sentBody.variables.test, true);
  assert.equal(sentBody.variables.lineItems[0].plan.appRecurringPricingDetails.price.amount, 79.0);
  assert.equal(sentBody.variables.lineItems[0].plan.appRecurringPricingDetails.price.currencyCode, 'USD');
  assert.equal(sentBody.variables.lineItems[0].plan.appRecurringPricingDetails.interval, 'EVERY_30_DAYS');
  assert.equal(fetchCalls[0].opts.headers['X-Shopify-Access-Token'], 'shpat_xxx');
});

test('createAppSubscription propage les userErrors Shopify', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        appSubscriptionCreate: {
          userErrors: [
            { field: ['lineItems', '0', 'plan'], message: 'Price must be greater than 0' },
          ],
          confirmationUrl: null,
          appSubscription: null,
        },
      },
    }),
  });

  await assert.rejects(
    () =>
      billing.createAppSubscription({
        shop: 'demo.myshopify.com',
        accessToken: 'shpat_xxx',
        name: 'X',
        amount: 79,
        currency: 'USD',
        returnUrl: 'https://app.feedplug.com/return',
        fetchImpl,
      }),
    /Shopify Billing userErrors.*Price must be greater than 0/
  );
});

test('createAppSubscription propage les errors GraphQL', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      errors: [{ message: 'access denied' }],
    }),
  });

  await assert.rejects(
    () =>
      billing.createAppSubscription({
        shop: 'demo.myshopify.com',
        accessToken: 'shpat_xxx',
        name: 'X',
        amount: 79,
        currency: 'USD',
        returnUrl: 'https://app.feedplug.com/return',
        fetchImpl,
      }),
    /Shopify GraphQL errors/
  );
});

test('cancelAppSubscription appelle la mutation et retourne le statut', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return {
      ok: true,
      json: async () => ({
        data: {
          appSubscriptionCancel: {
            userErrors: [],
            appSubscription: { id: 'gid://shopify/AppSubscription/12345', status: 'CANCELLED' },
          },
        },
      }),
    };
  };
  const sub = await billing.cancelAppSubscription({
    shop: 'demo.myshopify.com',
    accessToken: 'tok',
    subscriptionId: 'gid://shopify/AppSubscription/12345',
    prorate: true,
    fetchImpl,
  });
  assert.equal(sub.status, 'CANCELLED');
  const sent = JSON.parse(fetchCalls[0].opts.body);
  assert.equal(sent.variables.prorate, true);
});
