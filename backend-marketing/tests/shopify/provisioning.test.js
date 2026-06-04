const test = require('node:test');
const assert = require('node:assert/strict');

const {
  provisionAccountFromShopify,
  linkCredentialToAccount,
  fetchShopInfo,
} = require('../../domains/shopify/provisioning');

function createPrismaMock({
  existingUser = null,
  existingFeedSourceForCredential = null,
  credentialAlreadyLinked = null,
} = {}) {
  const calls = [];

  function $executeRawUnsafe(query, ...args) {
    calls.push({ kind: 'execute', query, args });
    return Promise.resolve(1);
  }

  function $queryRawUnsafe(query, ...args) {
    calls.push({ kind: 'query', query, args });
    // FeedSource lookup pour vérifier si Credential déjà liée
    // (match avec ou sans alias `s`)
    if (/FROM\s+"FeedSource"[\s\S]*credentialid/i.test(query)) {
      if (credentialAlreadyLinked) {
        return Promise.resolve([{ accountid: credentialAlreadyLinked, id: 'src-existing' }]);
      }
      if (existingFeedSourceForCredential) {
        return Promise.resolve([{ id: existingFeedSourceForCredential }]);
      }
      return Promise.resolve([]);
    }
    if (/FROM "User"/i.test(query)) {
      return Promise.resolve(existingUser ? [existingUser] : []);
    }
    return Promise.resolve([]);
  }

  return {
    prisma: { $executeRawUnsafe, $queryRawUnsafe },
    calls,
  };
}

function shopFetchOk(shopInfo) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { shop: shopInfo } }),
  });
}

const SAMPLE_SHOP = {
  id: 'gid://shopify/Shop/1',
  name: 'Demo Store',
  email: 'owner@demo.com',
  myshopifyDomain: 'demo.myshopify.com',
  contactEmail: 'owner@demo.com',
  currencyCode: 'EUR',
  primaryDomain: { host: 'demo.com' },
  billingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    phone: null,
    country: 'France',
    countryCodeV2: 'FR',
    city: 'Paris',
    zip: '75001',
    address1: '1 rue de Rivoli',
  },
};

test('fetchShopInfo rejette les domaines non-myshopify', async () => {
  await assert.rejects(
    () => fetchShopInfo({ shop: 'evil.com', accessToken: 'x' }),
    /Domaine Shopify invalide/
  );
});

test('provisionAccountFromShopify crée Account + User + Source + Feed quand nouveau', async () => {
  const { prisma, calls } = createPrismaMock();
  const fetchImpl = shopFetchOk(SAMPLE_SHOP);

  const result = await provisionAccountFromShopify({
    prisma,
    shop: 'demo.myshopify.com',
    accessToken: 'shpat_xxx',
    credentialId: 'cred-123',
    fetchImpl,
  });

  assert.equal(result.provisioned, true);
  assert.ok(result.accountId);
  assert.ok(result.userId);
  assert.equal(result.email, 'owner@demo.com');

  const inserts = calls.filter((c) => c.kind === 'execute' && /^\s*INSERT/i.test(c.query));
  const targets = inserts.map((c) => c.query.match(/INSERT INTO "(\w+)"/)?.[1]).filter(Boolean);
  assert.ok(targets.includes('Account'), 'doit insérer Account');
  assert.ok(targets.includes('User'), 'doit insérer User');
  assert.ok(targets.includes('FeedSource'), 'doit insérer FeedSource');
  assert.ok(targets.includes('Feed'), 'doit insérer Feed');
});

test('provisionAccountFromShopify retourne email_conflict si user local existe', async () => {
  const { prisma, calls } = createPrismaMock({
    existingUser: { id: 'u-1', accountid: 'acc-1', provider: 'local' },
  });
  const fetchImpl = shopFetchOk(SAMPLE_SHOP);

  const result = await provisionAccountFromShopify({
    prisma,
    shop: 'demo.myshopify.com',
    accessToken: 'shpat_xxx',
    credentialId: 'cred-123',
    fetchImpl,
  });

  assert.equal(result.provisioned, false);
  assert.equal(result.reason, 'email_conflict');
  assert.equal(result.email, 'owner@demo.com');

  // Ne doit PAS avoir tenté de créer un Account
  const accountInserts = calls.filter(
    (c) => c.kind === 'execute' && /INSERT INTO "Account"/i.test(c.query)
  );
  assert.equal(accountInserts.length, 0, 'aucun Account créé en email_conflict');
});

test('provisionAccountFromShopify link sur Account existant si User Shopify pré-existant', async () => {
  const { prisma, calls } = createPrismaMock({
    existingUser: { id: 'u-existing', accountid: 'acc-existing', provider: 'shopify' },
  });
  const fetchImpl = shopFetchOk(SAMPLE_SHOP);

  const result = await provisionAccountFromShopify({
    prisma,
    shop: 'demo.myshopify.com',
    accessToken: 'shpat_xxx',
    credentialId: 'cred-123',
    fetchImpl,
  });

  assert.equal(result.provisioned, false);
  assert.equal(result.existing, true);
  assert.equal(result.accountId, 'acc-existing');
  assert.equal(result.reason, 'shopify_user_exists');

  // Doit tout de même créer FeedSource + Feed liés à acc-existing
  const sourceInserts = calls.filter(
    (c) => c.kind === 'execute' && /INSERT INTO "FeedSource"/i.test(c.query)
  );
  assert.equal(sourceInserts.length, 1);
  assert.equal(sourceInserts[0].args[4], 'acc-existing', 'FeedSource doit pointer vers acc-existing');
});

test('provisionAccountFromShopify est idempotent : skip si Credential déjà liée', async () => {
  const { prisma, calls } = createPrismaMock({
    credentialAlreadyLinked: 'acc-pre-linked',
  });
  const fetchImpl = shopFetchOk(SAMPLE_SHOP);

  const result = await provisionAccountFromShopify({
    prisma,
    shop: 'demo.myshopify.com',
    accessToken: 'shpat_xxx',
    credentialId: 'cred-already',
    fetchImpl,
  });

  assert.equal(result.provisioned, false);
  assert.equal(result.existing, true);
  assert.equal(result.accountId, 'acc-pre-linked');
  assert.equal(result.reason, 'already_linked');

  // Ne doit appeler aucun INSERT (rien à faire)
  const inserts = calls.filter((c) => c.kind === 'execute' && /^\s*INSERT/i.test(c.query));
  assert.equal(inserts.length, 0);
});

test('linkCredentialToAccount idempotent : ne duplique pas FeedSource', async () => {
  const { prisma, calls } = createPrismaMock({
    existingFeedSourceForCredential: 'src-exists',
  });
  const result = await linkCredentialToAccount({
    prisma,
    accountId: 'acc-1',
    credentialId: 'cred-1',
    shop: 'demo.myshopify.com',
    shopName: 'Demo',
  });
  assert.equal(result.created, false);
  assert.equal(result.sourceId, 'src-exists');

  const sourceInserts = calls.filter(
    (c) => c.kind === 'execute' && /INSERT INTO "FeedSource"/i.test(c.query)
  );
  assert.equal(sourceInserts.length, 0);
});

test('provisionAccountFromShopify gère shop sans email', async () => {
  const { prisma, calls } = createPrismaMock();
  const fetchImpl = shopFetchOk({ ...SAMPLE_SHOP, email: null, contactEmail: null });

  const result = await provisionAccountFromShopify({
    prisma,
    shop: 'demo.myshopify.com',
    accessToken: 'shpat_xxx',
    credentialId: 'cred-123',
    fetchImpl,
  });

  assert.equal(result.provisioned, true);
  assert.ok(result.accountId);
  assert.equal(result.userId, null, 'pas de User créé sans email');
  assert.equal(result.email, null);

  const userInserts = calls.filter(
    (c) => c.kind === 'execute' && /INSERT INTO "User"/i.test(c.query)
  );
  assert.equal(userInserts.length, 0, 'aucun User créé sans email');
});
