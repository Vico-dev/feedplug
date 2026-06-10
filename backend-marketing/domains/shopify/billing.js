/**
 * Shopify Billing API — gestion des abonnements pour les merchants installés
 * via Shopify App Store.
 *
 * Pourquoi : pour obtenir le badge "Built for Shopify" et être éligible à
 * l'App Store, les apps payantes DOIVENT utiliser la Shopify Billing API
 * (et non Stripe / autre PSP). Les paiements transitent par Shopify Payments.
 *
 * Approche FeedPlug :
 *  - Merchants installés depuis Shopify → Shopify Billing
 *  - Merchants installés directement depuis feedplug.com → Stripe (legacy)
 *  - Distinction : colonne Account.billing_provider ('SHOPIFY' | 'STRIPE')
 *
 * Devise : on tente la devise du shop ; si non supportée par Shopify Billing,
 * on retombe sur USD avec conversion EUR → USD via taux configurable.
 *
 * Test mode : auto-activé hors production pour éviter facturation accidentelle.
 */

const crypto = require('crypto');
const { buildShopifyAdminGraphqlUrl } = require('./config');

// Devises supportées par Shopify Billing API.
// Source : Shopify Partners docs > Billing API > Currencies supported.
const SHOPIFY_BILLING_SUPPORTED_CURRENCIES = Object.freeze([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY',
  'SGD', 'HKD', 'DKK', 'NOK', 'SEK', 'CHF', 'CZK', 'PLN',
]);

const SHOPIFY_BILLING_FALLBACK_CURRENCY = 'USD';

function getEurToUsdRate() {
  const raw = Number(process.env.SHOPIFY_BILLING_EUR_USD_RATE);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 1.08;
}

function getCurrencyConversionFromEur(currency) {
  // On stocke uniquement EUR → USD et EUR → EUR ici. Pour les autres devises
  // supportées (GBP, CAD, etc.) on convertit via USD avec un taux env optionnel.
  const cur = String(currency || '').toUpperCase();
  if (cur === 'EUR') return 1;
  if (cur === 'USD') return getEurToUsdRate();
  const envKey = `SHOPIFY_BILLING_EUR_${cur}_RATE`;
  const raw = Number(process.env[envKey]);
  if (Number.isFinite(raw) && raw > 0) return raw;
  // Pas de taux configuré pour cette devise → on tombe sur USD via le caller.
  return null;
}

/**
 * Choisit la devise à utiliser pour la subscription Shopify.
 * Préfère la devise du shop si supportée, sinon fallback USD.
 *
 * @param {string} shopCurrencyCode
 * @returns {string} ISO 4217
 */
function pickShopifyBillingCurrency(shopCurrencyCode) {
  const cur = String(shopCurrencyCode || '').trim().toUpperCase();
  if (cur && SHOPIFY_BILLING_SUPPORTED_CURRENCIES.includes(cur)) {
    // On a besoin d'un taux de conversion EUR → cur pour calculer le prix.
    // Si on n'en a pas et que cur != EUR, on retombe sur USD (taux par défaut connu).
    if (cur === 'EUR') return 'EUR';
    if (getCurrencyConversionFromEur(cur) != null) return cur;
  }
  return SHOPIFY_BILLING_FALLBACK_CURRENCY;
}

/**
 * Calcule le prix dans la devise cible à partir d'un prix EUR.
 * Arrondi à 2 décimales (Shopify accepte montants décimaux).
 *
 * @param {number} amountEur
 * @param {string} targetCurrency
 * @returns {{ amount: number, currency: string }}
 */
function computeShopifyPrice(amountEur, targetCurrency) {
  const cur = pickShopifyBillingCurrency(targetCurrency);
  const rate = getCurrencyConversionFromEur(cur) ?? getEurToUsdRate();
  const raw = Number(amountEur) * rate;
  const amount = Math.round(raw * 100) / 100;
  return { amount, currency: cur };
}

/**
 * Vrai si on doit créer la subscription en test mode (sandbox).
 * Auto-détecté depuis NODE_ENV. Override possible via env SHOPIFY_BILLING_FORCE_TEST.
 */
function isShopifyBillingTestMode() {
  const forced = String(process.env.SHOPIFY_BILLING_FORCE_TEST || '').toLowerCase();
  if (forced === 'true' || forced === '1') return true;
  if (forced === 'false' || forced === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

function buildShopifyGraphqlEndpoint(shop) {
  return buildShopifyAdminGraphqlUrl(shop);
}

async function shopifyGraphql({ shop, accessToken, query, variables, fetchImpl = fetch }) {
  const endpoint = buildShopifyGraphqlEndpoint(shop);
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Shopify GraphQL HTTP ${response.status}: ${text || 'unknown error'}`);
  }
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

/**
 * Récupère la devise du shop Shopify pour décider de la devise de facturation.
 */
async function fetchShopCurrency({ shop, accessToken, fetchImpl }) {
  const data = await shopifyGraphql({
    shop,
    accessToken,
    fetchImpl,
    query: `query shopCurrency { shop { currencyCode } }`,
    variables: {},
  });
  return data?.shop?.currencyCode || '';
}

const APP_SUBSCRIPTION_CREATE_MUTATION = `
  mutation AppSubscriptionCreate(
    $name: String!,
    $returnUrl: URL!,
    $trialDays: Int,
    $test: Boolean,
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name,
      returnUrl: $returnUrl,
      trialDays: $trialDays,
      test: $test,
      lineItems: $lineItems
    ) {
      userErrors { field message }
      confirmationUrl
      appSubscription {
        id
        name
        status
        test
        trialDays
        createdAt
        currentPeriodEnd
      }
    }
  }
`;

/**
 * Crée une AppSubscription Shopify (récurrente mensuelle).
 *
 * @param {object} opts
 * @param {string} opts.shop                 ex: "demo.myshopify.com"
 * @param {string} opts.accessToken          OAuth access_token
 * @param {string} opts.name                 Libellé du plan visible au merchant
 * @param {number} opts.amount               Montant dans la devise cible
 * @param {string} opts.currency             ISO 4217
 * @param {string} opts.returnUrl            URL absolue de retour après approbation
 * @param {number} [opts.trialDays=0]
 * @param {boolean} [opts.test]              Override test mode (défaut: auto)
 * @param {Function} [opts.fetchImpl]
 */
async function createAppSubscription({
  shop,
  accessToken,
  name,
  amount,
  currency,
  returnUrl,
  trialDays = 0,
  test,
  fetchImpl,
}) {
  if (!shop || !accessToken) {
    throw new Error('createAppSubscription: shop et accessToken requis');
  }
  if (!name || !Number.isFinite(amount) || amount <= 0 || !currency || !returnUrl) {
    throw new Error('createAppSubscription: name/amount/currency/returnUrl requis');
  }

  const variables = {
    name,
    returnUrl,
    trialDays: Math.max(0, Math.floor(trialDays)),
    test: typeof test === 'boolean' ? test : isShopifyBillingTestMode(),
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount, currencyCode: currency },
            interval: 'EVERY_30_DAYS',
          },
        },
      },
    ],
  };

  const data = await shopifyGraphql({
    shop,
    accessToken,
    fetchImpl,
    query: APP_SUBSCRIPTION_CREATE_MUTATION,
    variables,
  });

  const result = data?.appSubscriptionCreate;
  if (!result) {
    throw new Error('Réponse Shopify Billing vide');
  }
  if (result.userErrors && result.userErrors.length > 0) {
    const message = result.userErrors.map((e) => `${(e.field || []).join('.')}: ${e.message}`).join('; ');
    throw new Error(`Shopify Billing userErrors: ${message}`);
  }
  if (!result.confirmationUrl || !result.appSubscription?.id) {
    throw new Error('Shopify Billing: confirmationUrl ou subscription.id manquant');
  }
  return {
    confirmationUrl: result.confirmationUrl,
    subscriptionId: result.appSubscription.id,
    subscription: result.appSubscription,
  };
}

const APP_SUBSCRIPTION_CANCEL_MUTATION = `
  mutation AppSubscriptionCancel($id: ID!, $prorate: Boolean) {
    appSubscriptionCancel(id: $id, prorate: $prorate) {
      userErrors { field message }
      appSubscription { id status }
    }
  }
`;

async function cancelAppSubscription({ shop, accessToken, subscriptionId, prorate = false, fetchImpl }) {
  if (!subscriptionId) throw new Error('cancelAppSubscription: subscriptionId requis');
  const data = await shopifyGraphql({
    shop,
    accessToken,
    fetchImpl,
    query: APP_SUBSCRIPTION_CANCEL_MUTATION,
    variables: { id: subscriptionId, prorate: Boolean(prorate) },
  });
  const result = data?.appSubscriptionCancel;
  if (!result) throw new Error('Réponse cancel vide');
  if (result.userErrors && result.userErrors.length > 0) {
    const message = result.userErrors.map((e) => `${(e.field || []).join('.')}: ${e.message}`).join('; ');
    throw new Error(`Shopify Billing cancel userErrors: ${message}`);
  }
  return result.appSubscription;
}

const APP_SUBSCRIPTION_NODE_QUERY = `
  query AppSubscription($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        name
        status
        test
        trialDays
        createdAt
        currentPeriodEnd
      }
    }
  }
`;

async function getAppSubscription({ shop, accessToken, subscriptionId, fetchImpl }) {
  if (!subscriptionId) throw new Error('getAppSubscription: subscriptionId requis');
  const data = await shopifyGraphql({
    shop,
    accessToken,
    fetchImpl,
    query: APP_SUBSCRIPTION_NODE_QUERY,
    variables: { id: subscriptionId },
  });
  return data?.node || null;
}

/**
 * Persiste un état de subscription Shopify (insert ou update).
 *
 * Le status interne suit la convention Shopify (PENDING, ACTIVE, CANCELLED,
 * EXPIRED, FROZEN, DECLINED).
 */
async function upsertShopifySubscription({ prisma, row }) {
  const id = row.id || crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO shopify_subscriptions (
        id, accountid, shop_domain, shopify_subscription_id,
        plan_key, price_amount, currency, interval, status,
        trial_days, trial_ends_at, current_period_end,
        confirmation_url, return_url, test_mode,
        createdat, updatedat
      ) VALUES (
        $1::text, $2::text, $3::text, $4::text,
        $5::text, $6::numeric, $7::text, $8::text, $9::text,
        $10::int, $11::timestamptz, $12::timestamptz,
        $13::text, $14::text, $15::boolean,
        NOW(), NOW()
      )
      ON CONFLICT (shopify_subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        trial_ends_at = EXCLUDED.trial_ends_at,
        confirmation_url = EXCLUDED.confirmation_url,
        return_url = EXCLUDED.return_url,
        test_mode = EXCLUDED.test_mode,
        updatedat = NOW()
    `,
    id,
    row.accountId,
    row.shopDomain,
    row.shopifySubscriptionId,
    row.planKey,
    Number(row.priceAmount),
    row.currency,
    row.interval || 'EVERY_30_DAYS',
    row.status || 'PENDING',
    Number(row.trialDays || 0),
    row.trialEndsAt || null,
    row.currentPeriodEnd || null,
    row.confirmationUrl || null,
    row.returnUrl || null,
    Boolean(row.testMode),
  );
  return id;
}

async function markShopifySubscriptionStatus({ prisma, shopifySubscriptionId, status, currentPeriodEnd, cancelled = false }) {
  await prisma.$executeRawUnsafe(
    `
      UPDATE shopify_subscriptions
      SET status = $2::text,
          current_period_end = COALESCE($3::timestamptz, current_period_end),
          cancelled_at = CASE WHEN $4::boolean THEN NOW() ELSE cancelled_at END,
          updatedat = NOW()
      WHERE shopify_subscription_id = $1::text
    `,
    shopifySubscriptionId,
    status,
    currentPeriodEnd || null,
    Boolean(cancelled),
  );
}

async function findActiveSubscriptionForAccount({ prisma, accountId }) {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT *
      FROM shopify_subscriptions
      WHERE accountid = $1::text
        AND status IN ('ACTIVE', 'PENDING')
      ORDER BY createdat DESC
      LIMIT 1
    `,
    accountId,
  );
  return rows?.[0] || null;
}

module.exports = {
  SHOPIFY_BILLING_SUPPORTED_CURRENCIES,
  SHOPIFY_BILLING_FALLBACK_CURRENCY,
  pickShopifyBillingCurrency,
  computeShopifyPrice,
  isShopifyBillingTestMode,
  fetchShopCurrency,
  createAppSubscription,
  cancelAppSubscription,
  getAppSubscription,
  upsertShopifySubscription,
  markShopifySubscriptionStatus,
  findActiveSubscriptionForAccount,
  // exposés pour tests
  _internals: {
    getEurToUsdRate,
    getCurrencyConversionFromEur,
    buildShopifyGraphqlEndpoint,
    shopifyGraphql,
  },
};
