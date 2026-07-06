const test = require('node:test');
const assert = require('node:assert');
const { isCsrfBlocked } = require('../../routes/comparator-account');

function req(method, origin) {
  const headers = {};
  if (origin !== undefined) headers.origin = origin;
  return { method, headers };
}

test('GET n\'est jamais bloqué (lecture, pas de mutation)', () => {
  assert.strictEqual(isCsrfBlocked(req('GET', 'https://evil.example')), false);
});

test('mutation avec Origin tiers → bloquée', () => {
  assert.strictEqual(isCsrfBlocked(req('POST', 'https://evil.example')), true);
  assert.strictEqual(isCsrfBlocked(req('DELETE', 'https://attacker.test')), true);
  assert.strictEqual(isCsrfBlocked(req('PUT', 'http://feedplug.com.evil.test')), true);
});

test('mutation avec Origin FeedPlug allowlisté → autorisée', () => {
  assert.strictEqual(isCsrfBlocked(req('POST', 'https://feedplug.com')), false);
  assert.strictEqual(isCsrfBlocked(req('DELETE', 'https://www.feedplug.com')), false);
  assert.strictEqual(isCsrfBlocked(req('PUT', 'https://app.feedplug.com')), false);
});

test('mutation SANS Origin (app native / server-to-server) → autorisée', () => {
  // La CSRF suppose un navigateur qui envoie toujours Origin sur une mutation
  // cross-site ; l'absence d'Origin n'est donc pas un vecteur CSRF.
  assert.strictEqual(isCsrfBlocked(req('DELETE', undefined)), false);
  assert.strictEqual(isCsrfBlocked(req('POST', '')), false);
});
