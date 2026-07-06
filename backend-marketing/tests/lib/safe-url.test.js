const test = require('node:test');
const assert = require('node:assert');
const { assertPublicHttpUrl, isPrivateIp } = require('../../lib/safe-url');

test('isPrivateIp bloque loopback / privé / link-local (metadata cloud)', () => {
  assert.strictEqual(isPrivateIp('127.0.0.1'), true);
  assert.strictEqual(isPrivateIp('10.0.0.5'), true);
  assert.strictEqual(isPrivateIp('192.168.1.1'), true);
  assert.strictEqual(isPrivateIp('172.16.0.1'), true);
  assert.strictEqual(isPrivateIp('169.254.169.254'), true); // GCP/AWS metadata
  assert.strictEqual(isPrivateIp('::1'), true);
  // Public : autorisé.
  assert.strictEqual(isPrivateIp('8.8.8.8'), false);
});

test('assertPublicHttpUrl rejette les schémas et hôtes internes (SSRF ingestion CSV)', async () => {
  await assert.rejects(() => assertPublicHttpUrl('file:///etc/passwd'), /Schéma/);
  await assert.rejects(() => assertPublicHttpUrl('http://127.0.0.1:5432/'), /IP non autorisée/);
  await assert.rejects(() => assertPublicHttpUrl('http://169.254.169.254/computeMetadata/v1/'), /IP non autorisée/);
  await assert.rejects(() => assertPublicHttpUrl('http://10.0.0.1/feed.csv'), /IP non autorisée/);
  await assert.rejects(() => assertPublicHttpUrl('gopher://x'), /Schéma/);
});

test('assertPublicHttpUrl accepte une IP publique littérale', async () => {
  const parsed = await assertPublicHttpUrl('http://8.8.8.8/feed.csv');
  assert.strictEqual(parsed.hostname, '8.8.8.8');
});
