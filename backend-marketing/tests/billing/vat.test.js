const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTaxRateForCountry,
  estimateTtc,
  DEFAULT_VAT_RATE,
  VAT_RATES_BY_COUNTRY,
} = require('../../lib/pricing');

test('getTaxRateForCountry returns the standard rate for known EU countries', () => {
  assert.equal(getTaxRateForCountry('FR'), 0.20);
  assert.equal(getTaxRateForCountry('DE'), 0.19);
  assert.equal(getTaxRateForCountry('ES'), 0.21);
  assert.equal(getTaxRateForCountry('IT'), 0.22);
});

test('getTaxRateForCountry is case-insensitive and trims whitespace', () => {
  assert.equal(getTaxRateForCountry('fr'), 0.20);
  assert.equal(getTaxRateForCountry('  de  '), 0.19);
});

test('getTaxRateForCountry falls back to default rate for unknown/empty country', () => {
  assert.equal(getTaxRateForCountry('US'), DEFAULT_VAT_RATE);
  assert.equal(getTaxRateForCountry(''), DEFAULT_VAT_RATE);
  assert.equal(getTaxRateForCountry(null), DEFAULT_VAT_RATE);
  assert.equal(getTaxRateForCountry(undefined), DEFAULT_VAT_RATE);
  assert.equal(getTaxRateForCountry(42), DEFAULT_VAT_RATE);
});

test('VAT_RATES_BY_COUNTRY is frozen and covers all 27 EU members', () => {
  assert.equal(Object.isFrozen(VAT_RATES_BY_COUNTRY), true);
  assert.equal(Object.keys(VAT_RATES_BY_COUNTRY).length, 27);
});

test('estimateTtc computes VAT and TTC from a HT amount (FR 20%)', () => {
  const result = estimateTtc(129, 'FR');
  assert.deepEqual(result, { rate: 0.20, vatEur: 25.8, ttcEur: 154.8 });
});

test('estimateTtc uses the country-specific rate (DE 19%)', () => {
  const result = estimateTtc(100, 'DE');
  assert.deepEqual(result, { rate: 0.19, vatEur: 19, ttcEur: 119 });
});

test('estimateTtc rounds to the cent', () => {
  const result = estimateTtc(79, 'FR');
  // 79 * 0.20 = 15.8 -> TTC 94.8
  assert.equal(result.vatEur, 15.8);
  assert.equal(result.ttcEur, 94.8);
});

test('estimateTtc returns null for a non-finite amount', () => {
  assert.equal(estimateTtc(NaN, 'FR'), null);
  assert.equal(estimateTtc(undefined, 'FR'), null);
});
