'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { summarize } = require('../../domains/cashback/wallet');

test('summarize: ventile pending / available / paid', () => {
  const w = summarize([
    { status: 'pending', total: 3.5, n: 2 },
    { status: 'validated', total: 4, n: 1 },
    { status: 'payable', total: 2, n: 1 },
    { status: 'paid', total: 10, n: 3 },
    { status: 'rejected', total: 99, n: 1 }, // ignoré
  ]);
  assert.strictEqual(w.pending, 3.5);
  assert.strictEqual(w.available, 6);      // validated + payable
  assert.strictEqual(w.paid, 10);
  assert.strictEqual(w.lifetime, 16);      // available + paid
  assert.strictEqual(w.currency, 'EUR');
});

test('summarize: wallet vide', () => {
  const w = summarize([]);
  assert.deepStrictEqual(w, { pending: 0, available: 0, paid: 0, lifetime: 0, currency: 'EUR' });
});
