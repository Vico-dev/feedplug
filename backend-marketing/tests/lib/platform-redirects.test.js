const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeDashboardReturnTo, buildDashboardRedirectUrl } = require('../../lib/platform-redirects');

test('normalizeDashboardReturnTo accepte les chemins relatifs same-origin', () => {
  assert.equal(normalizeDashboardReturnTo('/channels'), '/channels');
  assert.equal(normalizeDashboardReturnTo('/fr/channels'), '/fr/channels');
  assert.equal(normalizeDashboardReturnTo('/flux?tab=amazon'), '/flux?tab=amazon');
});

test('normalizeDashboardReturnTo bloque les open redirects', () => {
  // URL absolue, protocol-relative, schéma, vide → fallback
  assert.equal(normalizeDashboardReturnTo('https://evil.example/phish'), '/flux');
  assert.equal(normalizeDashboardReturnTo('//evil.example/phish'), '/flux');
  assert.equal(normalizeDashboardReturnTo('javascript:alert(1)'), '/flux');
  assert.equal(normalizeDashboardReturnTo(''), '/flux');
  assert.equal(normalizeDashboardReturnTo(null), '/flux');
  assert.equal(normalizeDashboardReturnTo(undefined, '/channels'), '/channels');
});

test('buildDashboardRedirectUrl construit une URL absolue avec les query params de statut', () => {
  assert.equal(
    buildDashboardRedirectUrl('https://app.feedplug.com', '/channels', { amazon: 'connected', seller: 'A1B2' }),
    'https://app.feedplug.com/channels?amazon=connected&seller=A1B2'
  );
  // Les valeurs vides/nulles sont ignorées
  assert.equal(
    buildDashboardRedirectUrl('https://app.feedplug.com', '/channels', { amazon: 'connected', seller: '' }),
    'https://app.feedplug.com/channels?amazon=connected'
  );
  // returnTo malveillant → retombe sur le fallback /flux
  assert.equal(
    buildDashboardRedirectUrl('https://app.feedplug.com', 'https://evil.example', { amazon: 'error', reason: 'config' }),
    'https://app.feedplug.com/flux?amazon=error&reason=config'
  );
});
