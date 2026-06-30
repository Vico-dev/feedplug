'use strict';
const test = require('node:test');
const assert = require('node:assert');

const {
  sanitizeName,
  normCountry,
  buildProfilePatch,
  toApiProfile,
  FIRSTNAME_MAX,
} = require('../../domains/comparator-account/profile');

test('sanitizeName: trim, effondre les espaces, borne, null si vide', () => {
  assert.strictEqual(sanitizeName('  Victor  ', 80), 'Victor');
  assert.strictEqual(sanitizeName('Jean   Paul', 80), 'Jean Paul');
  assert.strictEqual(sanitizeName('   ', 80), null);
  assert.strictEqual(sanitizeName('', 80), null);
  assert.strictEqual(sanitizeName(null, 80), null);
  assert.strictEqual(sanitizeName(42, 80), null);
  assert.strictEqual(sanitizeName('x'.repeat(200), FIRSTNAME_MAX).length, FIRSTNAME_MAX);
});

test('normCountry: ISO-2 majuscule, défaut FR', () => {
  assert.strictEqual(normCountry('fr'), 'FR');
  assert.strictEqual(normCountry(' gb '), 'GB');
  assert.strictEqual(normCountry('FRA'), 'FR');
  assert.strictEqual(normCountry(''), 'FR');
  assert.strictEqual(normCountry(undefined), 'FR');
});

test('buildProfilePatch: PATCH partiel, seuls les champs présents', () => {
  assert.deepStrictEqual(buildProfilePatch({}), {});
  assert.deepStrictEqual(buildProfilePatch({ firstName: ' Léa ' }), { firstname: 'Léa' });
  assert.deepStrictEqual(buildProfilePatch({ firstName: '' }), { firstname: null }); // effacement explicite
  assert.deepStrictEqual(buildProfilePatch({ countryCode: 'be' }), { countrycode: 'BE' });
  assert.deepStrictEqual(buildProfilePatch({ marketingOptIn: true }), { marketingoptin: true });
  assert.deepStrictEqual(buildProfilePatch({ marketingOptIn: 'yes' }), { marketingoptin: false }); // booléen strict
  assert.deepStrictEqual(
    buildProfilePatch({ firstName: 'A', lastName: 'B', countryCode: 'fr', marketingOptIn: false }),
    { firstname: 'A', lastname: 'B', countrycode: 'FR', marketingoptin: false },
  );
});

test('buildProfilePatch: ignore les clés absentes (ne fabrique pas firstname si non fourni)', () => {
  const patch = buildProfilePatch({ countryCode: 'fr' });
  assert.ok(!('firstname' in patch));
  assert.ok(!('marketingoptin' in patch));
});

test('toApiProfile: colonnes minuscules -> camelCase, null-safe', () => {
  assert.deepStrictEqual(
    toApiProfile({
      id: 'u1', email: 'a@b.c', firstname: 'Léa', lastname: null,
      countrycode: 'FR', locale: 'fr', marketingoptin: true,
    }),
    { id: 'u1', email: 'a@b.c', firstName: 'Léa', lastName: null, countryCode: 'FR', locale: 'fr', marketingOptIn: true },
  );
  assert.strictEqual(toApiProfile({ marketingoptin: undefined }).marketingOptIn, false);
});
