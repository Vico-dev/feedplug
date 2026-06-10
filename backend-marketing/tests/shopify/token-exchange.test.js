const test = require('node:test');
const assert = require('node:assert/strict');

const { exchangeSessionTokenForAccessToken, _constants } = require('../../domains/shopify/token-exchange');

function makeFetchMock({ status = 200, body = {}, captureRequest } = {}) {
  return async (url, init) => {
    if (captureRequest) {
      captureRequest({ url, init });
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
  };
}

test('exchangeSessionTokenForAccessToken POST sur le bon endpoint avec les bons params', async () => {
  let captured;
  const fetchImpl = makeFetchMock({
    status: 200,
    body: { access_token: 'shpat_abc', scope: 'read_products' },
    captureRequest: (r) => { captured = r; },
  });

  const result = await exchangeSessionTokenForAccessToken({
    shop: 'demo.myshopify.com',
    sessionToken: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
    clientId: 'client-123',
    clientSecret: 'secret-456',
    fetchImpl,
  });

  assert.equal(captured.url, 'https://demo.myshopify.com/admin/oauth/access_token');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers['Content-Type'], 'application/json');

  const body = JSON.parse(captured.init.body);
  assert.equal(body.client_id, 'client-123');
  assert.equal(body.client_secret, 'secret-456');
  assert.equal(body.grant_type, _constants.SHOPIFY_TOKEN_EXCHANGE_GRANT);
  assert.equal(body.subject_token, 'eyJhbGciOiJIUzI1NiJ9.payload.sig');
  assert.equal(body.subject_token_type, _constants.SHOPIFY_SUBJECT_TOKEN_TYPE_ID_TOKEN);
  assert.equal(body.requested_token_type, _constants.SHOPIFY_REQUESTED_TOKEN_TYPE_OFFLINE);

  assert.equal(result.accessToken, 'shpat_abc');
  assert.equal(result.scope, 'read_products');
});

test('exchangeSessionTokenForAccessToken supporte le mode online', async () => {
  let captured;
  const fetchImpl = makeFetchMock({
    status: 200,
    body: {
      access_token: 'shpat_online',
      scope: 'read_products',
      expires_in: 86400,
      associated_user_scope: 'read_products',
      associated_user: { id: 999, email: 'merchant@demo.com' },
    },
    captureRequest: (r) => { captured = r; },
  });

  const result = await exchangeSessionTokenForAccessToken({
    shop: 'demo.myshopify.com',
    sessionToken: 'tok',
    clientId: 'c',
    clientSecret: 's',
    tokenType: 'online',
    fetchImpl,
  });

  const body = JSON.parse(captured.init.body);
  assert.equal(body.requested_token_type, _constants.SHOPIFY_REQUESTED_TOKEN_TYPE_ONLINE);
  assert.equal(result.expiresIn, 86400);
  assert.equal(result.associatedUser.email, 'merchant@demo.com');
  assert.equal(result.associatedUserScope, 'read_products');
});

test('exchangeSessionTokenForAccessToken rejette si shop invalide', async () => {
  await assert.rejects(
    () => exchangeSessionTokenForAccessToken({
      shop: 'not-a-shop',
      sessionToken: 'tok',
      clientId: 'c',
      clientSecret: 's',
      fetchImpl: makeFetchMock(),
    }),
    /shop invalide/
  );
});

test('exchangeSessionTokenForAccessToken rejette si sessionToken manquant', async () => {
  await assert.rejects(
    () => exchangeSessionTokenForAccessToken({
      shop: 'demo.myshopify.com',
      sessionToken: '',
      clientId: 'c',
      clientSecret: 's',
      fetchImpl: makeFetchMock(),
    }),
    /sessionToken requis/
  );
});

test('exchangeSessionTokenForAccessToken rejette si clientId/clientSecret manquants', async () => {
  await assert.rejects(
    () => exchangeSessionTokenForAccessToken({
      shop: 'demo.myshopify.com',
      sessionToken: 'tok',
      clientId: '',
      clientSecret: 's',
      fetchImpl: makeFetchMock(),
    }),
    /clientId\/clientSecret requis/
  );
});

test('exchangeSessionTokenForAccessToken propage les erreurs HTTP non-2xx', async () => {
  const fetchImpl = makeFetchMock({
    status: 401,
    body: { error: 'invalid_subject_token' },
  });

  await assert.rejects(
    () => exchangeSessionTokenForAccessToken({
      shop: 'demo.myshopify.com',
      sessionToken: 'tok',
      clientId: 'c',
      clientSecret: 's',
      fetchImpl,
    }),
    /HTTP 401/
  );
});

test('exchangeSessionTokenForAccessToken rejette si access_token absent de la réponse', async () => {
  const fetchImpl = makeFetchMock({
    status: 200,
    body: { scope: 'read_products' },
  });

  await assert.rejects(
    () => exchangeSessionTokenForAccessToken({
      shop: 'demo.myshopify.com',
      sessionToken: 'tok',
      clientId: 'c',
      clientSecret: 's',
      fetchImpl,
    }),
    /access_token manquant/
  );
});
