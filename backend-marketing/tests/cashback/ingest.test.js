'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeCashback, mapAwinStatus, amount, clickrefOf } = require('../../domains/cashback/ingest');

test('computeCashback: part de commission, arrondi 2 décimales', () => {
  assert.strictEqual(computeCashback(10, 0.5), 5);
  assert.strictEqual(computeCashback({ amount: 8.33, currency: 'EUR' }, 0.7), 5.83); // 8.33*0.7=5.831
  assert.strictEqual(computeCashback(10, 2), 5);   // share invalide → défaut 0.5
  assert.strictEqual(computeCashback(null, 0.5), 0);
});

test('mapAwinStatus: AWIN brut → ledger', () => {
  assert.strictEqual(mapAwinStatus('approved'), 'validated');
  assert.strictEqual(mapAwinStatus('declined'), 'rejected');
  assert.strictEqual(mapAwinStatus('rejected'), 'rejected');
  assert.strictEqual(mapAwinStatus('pending'), 'pending');
  assert.strictEqual(mapAwinStatus(undefined), 'pending');
});

test('amount: nombre OU objet AWIN {amount,currency}', () => {
  assert.strictEqual(amount(12.5), 12.5);
  assert.strictEqual(amount({ amount: 9.9, currency: 'EUR' }), 9.9);
  assert.strictEqual(amount(null), 0);
});

test('clickrefOf: clickRef / clickref', () => {
  assert.strictEqual(clickrefOf({ clickRef: 'abc' }), 'abc');
  assert.strictEqual(clickrefOf({ clickref: 'def' }), 'def');
  assert.strictEqual(clickrefOf({}), null);
});
