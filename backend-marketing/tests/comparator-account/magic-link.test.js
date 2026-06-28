'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  generateToken,
  hashToken,
  isValidEmail,
  normalizeEmail,
} = require('../../domains/comparator-account/magic-link');

test('generateToken: base64url 256 bits, unique', () => {
  const a = generateToken();
  const b = generateToken();
  assert.notStrictEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 42, `token trop court: ${a.length}`);
});

test('hashToken: sha256 hex déterministe, sans le token en clair', () => {
  assert.strictEqual(hashToken('abc'), hashToken('abc'));
  assert.match(hashToken('abc'), /^[0-9a-f]{64}$/);
  assert.notStrictEqual(hashToken('abc'), hashToken('abd'));
  assert.ok(!hashToken('secret').includes('secret'));
});

test('normalizeEmail: trim + lowercase', () => {
  assert.strictEqual(normalizeEmail('  Foo@Bar.CO '), 'foo@bar.co');
  assert.strictEqual(normalizeEmail(null), '');
});

test('isValidEmail', () => {
  assert.ok(isValidEmail('a@b.co'));
  assert.ok(isValidEmail('  User@Domain.Com '));
  assert.ok(!isValidEmail('nope'));
  assert.ok(!isValidEmail('a@b'));
  assert.ok(!isValidEmail(''));
  assert.ok(!isValidEmail('a@b.c' + 'x'.repeat(260)));
});
