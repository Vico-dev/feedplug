'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { shouldAlert, runPriceAlerts } = require('../../domains/comparator-account/price-alerts');

test('shouldAlert: baisse au-delà du seuil → alerte', () => {
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 90, lastAlertedPrice: null, thresholdPct: 5 }), true);
});

test('shouldAlert: baisse sous le seuil → pas d’alerte', () => {
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 97, lastAlertedPrice: null, thresholdPct: 5 }), false);
});

test('shouldAlert: hausse → pas d’alerte', () => {
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 110, lastAlertedPrice: null, thresholdPct: 5 }), false);
});

test('shouldAlert: anti-spam — déjà alerté à ce prix ou plus bas → pas de ré-alerte', () => {
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 90, lastAlertedPrice: 90, thresholdPct: 5 }), false);
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 92, lastAlertedPrice: 90, thresholdPct: 5 }), false);
});

test('shouldAlert: ré-alerte si le prix descend SOUS le dernier prix alerté', () => {
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 85, lastAlertedPrice: 90, thresholdPct: 5 }), true);
});

test('shouldAlert: données invalides → false', () => {
  assert.strictEqual(shouldAlert({ priceAtAdd: null, currentPrice: 90, lastAlertedPrice: null, thresholdPct: 5 }), false);
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 0, lastAlertedPrice: null, thresholdPct: 5 }), false);
  assert.strictEqual(shouldAlert({ priceAtAdd: 100, currentPrice: 90, lastAlertedPrice: null, thresholdPct: 0 }), false);
});

// Mock prisma : queryRawUnsafe → lignes de findDrops ; executeRawUnsafe → markAlerted.
function makePrisma(rows) {
  const calls = [];
  return {
    calls,
    $queryRawUnsafe: async () => rows,
    $executeRawUnsafe: async (sql, ...params) => { calls.push({ sql, params }); return 1; },
  };
}

const row = (over = {}) => ({
  id: 'w1', userid: 'u1', groupid: 'g1', countrycode: 'FR',
  priceatadd: 100, lastalertedprice: null, currentprice: 90, currency: 'EUR',
  canonicaltitle: 'Sac Dana', brand: 'Mac Alyster', imageurl: null, email: 'u1@ex.com',
  ...over,
});

test('runPriceAlerts: groupe par user, envoie push + email digest, markAlerted', async () => {
  const prisma = makePrisma([
    row(),
    row({ id: 'w2', groupid: 'g2', canonicaltitle: 'Cabas', currentprice: 80, priceatadd: 120 }),
    row({ id: 'w3', userid: 'u2', email: 'u2@ex.com', groupid: 'g3' }),
  ]);
  const pushes = []; const emails = [];
  const out = await runPriceAlerts(prisma, 'comparator', {
    sendPush: async (userId, payload) => pushes.push({ userId, payload }),
    sendEmail: async (email, items) => emails.push({ email, items }),
  });
  assert.strictEqual(out.users, 2);
  assert.strictEqual(out.alerted, 3);
  assert.strictEqual(out.errors, 0);
  // u1 : un seul push groupé (2 produits) + un email digest de 2 items.
  const u1Push = pushes.find((p) => p.userId === 'u1');
  assert.ok(u1Push.payload.title.includes('2 produits'));
  const u1Mail = emails.find((e) => e.email === 'u1@ex.com');
  assert.strictEqual(u1Mail.items.length, 2);
  // markAlerted appelé pour les 3 lignes.
  const marks = prisma.calls.filter((c) => c.sql.includes('lastalertedprice'));
  assert.strictEqual(marks.length, 3);
});

test('runPriceAlerts: sous le seuil ou déjà alerté → rien', async () => {
  const prisma = makePrisma([
    row({ currentprice: 97 }),                       // -3 % < seuil 5 %
    row({ id: 'w2', currentprice: 90, lastalertedprice: 90 }), // déjà alerté à ce prix
  ]);
  const pushes = [];
  const out = await runPriceAlerts(prisma, 'comparator', {
    sendPush: async (u, p) => pushes.push(p),
    sendEmail: async () => {},
  });
  assert.strictEqual(out.alerted, 0);
  assert.strictEqual(pushes.length, 0);
});

test('runPriceAlerts: échec d’envoi pour un user → pas de markAlerted pour lui, les autres passent', async () => {
  const prisma = makePrisma([
    row(),                                            // u1 → échec
    row({ id: 'w3', userid: 'u2', email: 'u2@ex.com' }), // u2 → OK
  ]);
  const out = await runPriceAlerts(prisma, 'comparator', {
    sendPush: async (userId) => { if (userId === 'u1') throw new Error('boom'); },
    sendEmail: async () => {},
  });
  assert.strictEqual(out.errors, 1);
  assert.strictEqual(out.users, 1);
  assert.strictEqual(out.alerted, 1);
  const marks = prisma.calls.filter((c) => c.sql.includes('lastalertedprice'));
  assert.strictEqual(marks.length, 1);
  assert.strictEqual(marks[0].params[1], 'w3');
});
