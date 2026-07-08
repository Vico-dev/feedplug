'use strict';
const test = require('node:test');
const assert = require('node:assert');

const {
  isValidSubscription,
  isValidNativeToken,
  sendToUser,
} = require('../../domains/comparator-account/push');

// Mock prisma minimal : queryRawUnsafe renvoie les abonnements, executeRawUnsafe
// journalise les mutations (purge, compteur d'échec, lastnotifiedat).
function makePrisma(rows) {
  const calls = [];
  return {
    calls,
    $queryRawUnsafe: async () => rows,
    $executeRawUnsafe: async (sql, ...params) => { calls.push({ sql, params }); return 1; },
  };
}

const WEB_SUB = { endpoint: 'https://push.example.com/x', keys: { p256dh: 'k1', auth: 'k2' } };

test('isValidSubscription: shape web push stricte', () => {
  assert.strictEqual(isValidSubscription(WEB_SUB), true);
  assert.strictEqual(isValidSubscription({ endpoint: 'http://insecure', keys: WEB_SUB.keys }), false);
  assert.strictEqual(isValidSubscription({ endpoint: WEB_SUB.endpoint, keys: { p256dh: 'k' } }), false);
  assert.strictEqual(isValidSubscription(null), false);
  assert.strictEqual(isValidSubscription({}), false);
});

test('isValidNativeToken: platform ios/android + token non vide', () => {
  assert.strictEqual(isValidNativeToken({ platform: 'ios', token: 'abc' }), true);
  assert.strictEqual(isValidNativeToken({ platform: 'android', token: 'abc' }), true);
  assert.strictEqual(isValidNativeToken({ platform: 'web', token: 'abc' }), false);
  assert.strictEqual(isValidNativeToken({ platform: 'ios', token: '  ' }), false);
  assert.strictEqual(isValidNativeToken(null), false);
});

test('sendToUser: envoie web et natif via les senders injectés', async () => {
  const prisma = makePrisma([
    { id: 'w1', endpoint: WEB_SUB.endpoint, p256dh: 'k1', auth: 'k2', token: null, platform: 'web' },
    { id: 'n1', endpoint: null, p256dh: null, auth: null, token: 'tok-1', platform: 'ios' },
  ]);
  const sentWeb = []; const sentNative = [];
  const out = await sendToUser(prisma, 'user-1', { title: 't', body: 'b' }, {
    webSender: async (sub, payload) => { sentWeb.push({ sub, payload }); return { sent: true }; },
    nativeSender: async (token, payload) => { sentNative.push({ token, payload }); return { sent: true }; },
  });
  assert.strictEqual(out.sent, 2);
  assert.strictEqual(out.failed, 0);
  assert.strictEqual(sentWeb.length, 1);
  assert.strictEqual(sentWeb[0].sub.endpoint, WEB_SUB.endpoint);
  assert.strictEqual(sentNative[0].token, 'tok-1');
});

test('sendToUser: 410 web → purge de l’abonnement', async () => {
  const prisma = makePrisma([
    { id: 'w1', endpoint: WEB_SUB.endpoint, p256dh: 'k1', auth: 'k2', token: null, platform: 'web' },
  ]);
  const out = await sendToUser(prisma, 'user-1', { title: 't', body: 'b' }, {
    webSender: async () => { const e = new Error('gone'); e.statusCode = 410; throw e; },
  });
  assert.strictEqual(out.purged, 1);
  assert.ok(prisma.calls.some((c) => c.sql.includes('DELETE FROM "ComparatorPushSubscription"')));
});

test('sendToUser: erreur transitoire → failurecount incrémenté, pas de purge', async () => {
  const prisma = makePrisma([
    { id: 'w1', endpoint: WEB_SUB.endpoint, p256dh: 'k1', auth: 'k2', token: null, platform: 'web' },
  ]);
  const out = await sendToUser(prisma, 'user-1', { title: 't', body: 'b' }, {
    webSender: async () => { const e = new Error('boom'); e.statusCode = 500; throw e; },
  });
  assert.strictEqual(out.failed, 1);
  assert.strictEqual(out.purged, 0);
  assert.ok(prisma.calls.some((c) => c.sql.includes('failurecount = failurecount + 1')));
});

test('sendToUser: sender non configuré ({skipped}) → comptés skipped, zéro erreur', async () => {
  const prisma = makePrisma([
    { id: 'w1', endpoint: WEB_SUB.endpoint, p256dh: 'k1', auth: 'k2', token: null, platform: 'web' },
    { id: 'n1', endpoint: null, p256dh: null, auth: null, token: 'tok-1', platform: 'ios' },
  ]);
  const out = await sendToUser(prisma, 'user-1', { title: 't', body: 'b' }, {
    webSender: async () => ({ skipped: true, reason: 'VAPID non configuré' }),
    nativeSender: async () => ({ skipped: true, reason: 'FCM non configuré' }),
  });
  assert.deepStrictEqual({ sent: out.sent, skipped: out.skipped, failed: out.failed }, { sent: 0, skipped: 2, failed: 0 });
});
