const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkSecret,
  normalizeCountryCode,
  isValidApprovalStatus,
} = require('../../routes/comparator');

test('checkSecret accepte deux secrets identiques non vides', () => {
  assert.equal(checkSecret('s3cr3t-token', 's3cr3t-token'), true);
});

test('checkSecret refuse un secret différent de même longueur', () => {
  assert.equal(checkSecret('aaaaaa', 'bbbbbb'), false);
});

test('checkSecret refuse des longueurs différentes (pas de crash timingSafeEqual)', () => {
  assert.equal(checkSecret('short', 'longer-secret'), false);
  assert.equal(checkSecret('longer-secret', 'short'), false);
});

test('checkSecret refuse les valeurs vides ou non-string', () => {
  assert.equal(checkSecret('', ''), false);
  assert.equal(checkSecret('abc', ''), false);
  assert.equal(checkSecret('', 'abc'), false);
  assert.equal(checkSecret(null, 'abc'), false);
  assert.equal(checkSecret('abc', undefined), false);
  assert.equal(checkSecret(123, 123), false);
});

test('normalizeCountryCode met en majuscules un alpha-2 valide', () => {
  assert.equal(normalizeCountryCode('fr'), 'FR');
  assert.equal(normalizeCountryCode('FR'), 'FR');
  assert.equal(normalizeCountryCode(' gb '), 'GB');
});

test('normalizeCountryCode rejette ce qui n\'est pas exactement 2 lettres', () => {
  assert.equal(normalizeCountryCode('FRA'), null);
  assert.equal(normalizeCountryCode(''), null);
  assert.equal(normalizeCountryCode('F'), null);
  assert.equal(normalizeCountryCode('F1'), null);
  assert.equal(normalizeCountryCode('  '), null);
  assert.equal(normalizeCountryCode(null), null);
  assert.equal(normalizeCountryCode(33), null);
});

test('isValidApprovalStatus accepte uniquement les statuts connus', () => {
  assert.equal(isValidApprovalStatus('pending'), true);
  assert.equal(isValidApprovalStatus('approved'), true);
  assert.equal(isValidApprovalStatus('rejected'), true);
  assert.equal(isValidApprovalStatus('revoked'), true);
  assert.equal(isValidApprovalStatus('APPROVED'), false);
  assert.equal(isValidApprovalStatus('autre'), false);
  assert.equal(isValidApprovalStatus(''), false);
  assert.equal(isValidApprovalStatus(null), false);
});
