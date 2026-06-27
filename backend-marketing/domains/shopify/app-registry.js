/**
 * Registre des apps Shopify (multi-app).
 *
 * FeedPlug expose DEUX apps Shopify partageant ce backend :
 *  - `listed`    : app App Store embedded, facturée via Managed Pricing.
 *  - `connector` : app unlisted gratuite (marchands venus de feedplug.com qui
 *                  paient via Stripe et importent juste leur catalogue). NON
 *                  embedded, PAS de billing.
 *
 * Chaque app signe ses webhooks / OAuth / session-tokens avec SA propre clé.
 * Ce module construit la table {appId -> creds} depuis l'environnement et
 * fournit un resolver. L'entrée `connector` est OPTIONNELLE : si ses variables
 * d'env sont absentes, l'app B est simplement désactivée et l'app A reste
 * strictement inchangée (premier déploiement sûr).
 *
 * Extrait en module pour être testable sans booter le serveur.
 */

const DEFAULT_CATALOG_SCOPES = 'read_products';
const LISTED_WEBHOOK_PATH = '/api/v1/webhooks/shopify';
const CONNECTOR_WEBHOOK_PATH = '/api/v1/webhooks/shopify/connector';
const DEFAULT_CALLBACK_URL =
  'https://api.feedplug.com/api/v1/connectors/shopify/callback';

/**
 * Construit le registre des apps Shopify depuis un objet d'environnement.
 *
 * @param {object} [env=process.env]
 * @param {object} [opts]
 * @param {string} [opts.defaultScopes] Scopes par défaut de l'app listée
 *                                      (alignés sur shopify.app.toml).
 * @returns {{ listed: object, connector?: object }}
 */
function buildShopifyApps(env = process.env, opts = {}) {
  const defaultScopes = opts.defaultScopes || DEFAULT_CATALOG_SCOPES;

  const apps = {
    listed: {
      appId: 'listed',
      apiKey: env.SHOPIFY_API_KEY || '',
      apiSecret: env.SHOPIFY_API_SECRET || '',
      callbackUrl: env.SHOPIFY_CALLBACK_URL || DEFAULT_CALLBACK_URL,
      scopes: env.SHOPIFY_SCOPES || defaultScopes,
      webhookPath: LISTED_WEBHOOK_PATH,
      embedded: true,
      billing: true,
      billingProvider: 'SHOPIFY',
    },
  };

  // L'app connecteur n'existe que si ses deux clés sont configurées.
  if (env.SHOPIFY_CONNECTOR_API_KEY && env.SHOPIFY_CONNECTOR_API_SECRET) {
    apps.connector = {
      appId: 'connector',
      apiKey: env.SHOPIFY_CONNECTOR_API_KEY,
      apiSecret: env.SHOPIFY_CONNECTOR_API_SECRET,
      // Le callback peut être partagé (l'app est résolue depuis le state, pas
      // depuis le chemin) ; chaque app doit néanmoins l'avoir autorisé côté Partners.
      callbackUrl:
        env.SHOPIFY_CONNECTOR_CALLBACK_URL ||
        env.SHOPIFY_CALLBACK_URL ||
        DEFAULT_CALLBACK_URL,
      scopes: env.SHOPIFY_CONNECTOR_SCOPES || DEFAULT_CATALOG_SCOPES,
      webhookPath: CONNECTOR_WEBHOOK_PATH,
      embedded: false,
      billing: false,
      billingProvider: 'STRIPE',
    };
  }

  return apps;
}

/**
 * Résout l'entrée d'app pour un appId donné. Tout appId inconnu/absent
 * retombe sur `listed` (gère les states OAuth legacy sans appId, et le cas
 * où l'app connecteur n'est pas configurée).
 *
 * @param {{ listed: object, connector?: object }} apps
 * @param {string} [appId]
 * @returns {object} l'entrée d'app (jamais null tant que `listed` existe)
 */
function resolveShopifyApp(apps, appId) {
  if (appId === 'connector' && apps.connector) {
    return apps.connector;
  }
  return apps.listed;
}

module.exports = {
  buildShopifyApps,
  resolveShopifyApp,
  LISTED_WEBHOOK_PATH,
  CONNECTOR_WEBHOOK_PATH,
};
