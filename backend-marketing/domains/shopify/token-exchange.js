/**
 * Shopify Token Exchange — récupération d'un access_token depuis un session
 * token App Bridge (id_token JWT signé par Shopify).
 *
 * Pourquoi : depuis 2024 Shopify pousse la Managed Installation
 * (use_legacy_install_flow=false). Dans ce mode, Shopify gère lui-même l'OAuth
 * lors de l'install et n'appelle jamais notre callback. La seule manière de
 * récupérer un access_token côté serveur est de faire un Token Exchange :
 *
 *   POST https://{shop}/admin/oauth/access_token
 *   grant_type = urn:ietf:params:oauth:grant-type:token-exchange
 *   subject_token = <session_token reçu via App Bridge>
 *   subject_token_type = urn:ietf:params:oauth:token-type:id_token
 *   requested_token_type = urn:shopify:params:oauth:token-type:offline-access-token
 *
 * Le token retourné est utilisable pour les calls Admin GraphQL/REST tant que
 * l'app reste installée. On stocke ce token comme une Credential classique.
 *
 * Doc : https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
 */

const SHOPIFY_TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const SHOPIFY_SUBJECT_TOKEN_TYPE_ID_TOKEN = 'urn:ietf:params:oauth:token-type:id_token';
const SHOPIFY_REQUESTED_TOKEN_TYPE_OFFLINE = 'urn:shopify:params:oauth:token-type:offline-access-token';
const SHOPIFY_REQUESTED_TOKEN_TYPE_ONLINE = 'urn:shopify:params:oauth:token-type:online-access-token';

/**
 * Échange un session token App Bridge contre un access_token Admin API.
 *
 * @param {object} opts
 * @param {string} opts.shop                ex: "demo.myshopify.com"
 * @param {string} opts.sessionToken        JWT signé par Shopify (id_token App Bridge)
 * @param {string} opts.clientId            SHOPIFY_API_KEY
 * @param {string} opts.clientSecret        SHOPIFY_API_SECRET
 * @param {'offline'|'online'} [opts.tokenType='offline']  Offline = persistant ; online = lié à l'user
 * @param {Function} [opts.fetchImpl]       Pour les tests
 * @returns {Promise<{ accessToken: string, scope: string, expiresIn?: number,
 *                     associatedUserScope?: string, associatedUser?: object }>}
 */
async function exchangeSessionTokenForAccessToken({
  shop,
  sessionToken,
  clientId,
  clientSecret,
  tokenType = 'offline',
  fetchImpl = fetch,
}) {
  if (!shop || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(String(shop))) {
    throw new Error(`exchangeSessionTokenForAccessToken: shop invalide (${shop})`);
  }
  if (!sessionToken) {
    throw new Error('exchangeSessionTokenForAccessToken: sessionToken requis');
  }
  if (!clientId || !clientSecret) {
    throw new Error('exchangeSessionTokenForAccessToken: clientId/clientSecret requis');
  }

  const requestedTokenType = tokenType === 'online'
    ? SHOPIFY_REQUESTED_TOKEN_TYPE_ONLINE
    : SHOPIFY_REQUESTED_TOKEN_TYPE_OFFLINE;

  const endpoint = `https://${shop}/admin/oauth/access_token`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: SHOPIFY_TOKEN_EXCHANGE_GRANT,
      subject_token: sessionToken,
      subject_token_type: SHOPIFY_SUBJECT_TOKEN_TYPE_ID_TOKEN,
      requested_token_type: requestedTokenType,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Shopify Token Exchange HTTP ${response.status}: ${text || 'unknown error'}`);
  }

  const data = await response.json();
  if (!data || typeof data.access_token !== 'string' || !data.access_token) {
    throw new Error('Shopify Token Exchange: access_token manquant dans la réponse');
  }

  return {
    accessToken: data.access_token,
    scope: typeof data.scope === 'string' ? data.scope : '',
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    associatedUserScope: typeof data.associated_user_scope === 'string' ? data.associated_user_scope : undefined,
    associatedUser: data.associated_user || undefined,
  };
}

module.exports = {
  exchangeSessionTokenForAccessToken,
  // exposés pour tests
  _constants: {
    SHOPIFY_TOKEN_EXCHANGE_GRANT,
    SHOPIFY_SUBJECT_TOKEN_TYPE_ID_TOKEN,
    SHOPIFY_REQUESTED_TOKEN_TYPE_OFFLINE,
    SHOPIFY_REQUESTED_TOKEN_TYPE_ONLINE,
  },
};
