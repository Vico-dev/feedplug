'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  sanitizeDemographics,
  sanitizeBrands,
  sanitizeRegion,
  affinityBonus,
} = require('../../domains/comparator-account/personalization');

test('sanitizeDemographics: garde les valeurs de la liste blanche, sinon null', () => {
  const out = sanitizeDemographics({
    agerange: '25-34',
    gender: 'F',
    region: ' IDF ',
    household: 'couple',
    budgetrange: 'premium',
    consent: true,
  });
  assert.deepStrictEqual(out, {
    agerange: '25-34',
    gender: 'f',
    region: 'idf',
    household: 'couple',
    budgetrange: 'premium',
    consent: true,
  });
});

test('sanitizeDemographics: valeurs hors-liste → null, jamais d’erreur', () => {
  const out = sanitizeDemographics({
    agerange: '99-100',
    gender: 'xyz',
    region: 'a b c',
    household: 'palace',
    budgetrange: 'lux',
    consent: 'nope',
  });
  assert.deepStrictEqual(out, {
    agerange: null, gender: null, region: null, household: null, budgetrange: null, consent: false,
  });
});

test('sanitizeDemographics: entrée non-objet → tout null, consent false', () => {
  const out = sanitizeDemographics(null);
  assert.deepStrictEqual(out, {
    agerange: null, gender: null, region: null, household: null, budgetrange: null, consent: false,
  });
  assert.strictEqual(sanitizeDemographics('x').agerange, null);
});

test('sanitizeDemographics: consent accepte true ou "true" uniquement', () => {
  assert.strictEqual(sanitizeDemographics({ consent: true }).consent, true);
  assert.strictEqual(sanitizeDemographics({ consent: 'true' }).consent, true);
  assert.strictEqual(sanitizeDemographics({ consent: 1 }).consent, false);
  assert.strictEqual(sanitizeDemographics({ consent: 'yes' }).consent, false);
  assert.strictEqual(sanitizeDemographics({}).consent, false);
});

test('sanitizeRegion: 2-6 caractères a-z0-9-, sinon null', () => {
  assert.strictEqual(sanitizeRegion('75'), '75');
  assert.strictEqual(sanitizeRegion(' IDF '), 'idf');
  assert.strictEqual(sanitizeRegion('2A'), '2a');
  assert.strictEqual(sanitizeRegion(''), null);
  assert.strictEqual(sanitizeRegion('toolongregion'), null);
  assert.strictEqual(sanitizeRegion('a b'), null);
  assert.strictEqual(sanitizeRegion(42), null);
});

test('sanitizeBrands: trim, minuscule, dédoublonne, borne à 30', () => {
  assert.deepStrictEqual(sanitizeBrands(['Apple', 'apple', ' Nike ']), ['apple', 'nike']);
  assert.deepStrictEqual(sanitizeBrands(['ok', 123, null, '', 'x'.repeat(81)]), ['ok']);
  assert.deepStrictEqual(sanitizeBrands('nope'), []);
  assert.deepStrictEqual(sanitizeBrands(null), []);
  assert.strictEqual(sanitizeBrands(Array.from({ length: 50 }, (_, i) => `b${i}`)).length, 30);
});

test('affinityBonus: bonus négatif si marque favorite, 0 sinon', () => {
  const fav = new Set(['apple', 'nike']);
  assert.strictEqual(affinityBonus('Apple', fav), -12);
  assert.strictEqual(affinityBonus(' nike ', fav), -12);
  assert.strictEqual(affinityBonus('Samsung', fav), 0);
  assert.strictEqual(affinityBonus(null, fav), 0);
  assert.strictEqual(affinityBonus('Apple', new Set()), 0);
  assert.strictEqual(affinityBonus('Apple', null), 0);
  assert.strictEqual(affinityBonus('Apple', fav, 20), -20);
});
