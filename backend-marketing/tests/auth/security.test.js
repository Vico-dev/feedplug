const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashAuthActionToken,
  normalizeAuthActionToken,
  validatePasswordPolicy,
} = require('../../domains/auth/security');

test('normalizeAuthActionToken trims and sanitizes invalid inputs', () => {
  assert.equal(normalizeAuthActionToken('  abc  '), 'abc');
  assert.equal(normalizeAuthActionToken(null), '');
});

test('hashAuthActionToken returns deterministic sha256 hashes', () => {
  const first = hashAuthActionToken(' token ');
  const second = hashAuthActionToken('token');
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test('validatePasswordPolicy rejects weak passwords and accepts strong ones', () => {
  assert.deepEqual(validatePasswordPolicy('short'), {
    valid: false,
    code: 'min_length',
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  });
  assert.deepEqual(validatePasswordPolicy('longpassword1'), {
    valid: false,
    code: 'uppercase',
    message: 'Le mot de passe doit contenir au moins une majuscule',
  });
  assert.deepEqual(validatePasswordPolicy('Longpassword'), {
    valid: false,
    code: 'digit',
    message: 'Le mot de passe doit contenir au moins un chiffre',
  });
  assert.deepEqual(validatePasswordPolicy('Longpassword1'), {
    valid: true,
    code: null,
    message: null,
  });
});
