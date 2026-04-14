const crypto = require('crypto');

const PASSWORD_POLICY = Object.freeze({
  minLength: 8,
  requiresUppercase: true,
  requiresDigit: true,
});

function normalizeAuthActionToken(token) {
  if (typeof token !== 'string') return '';
  return token.trim();
}

function hashAuthActionToken(token) {
  const normalizedToken = normalizeAuthActionToken(token);
  if (!normalizedToken) return '';
  return crypto.createHash('sha256').update(normalizedToken).digest('hex');
}

function validatePasswordPolicy(password) {
  const value = typeof password === 'string' ? password : '';
  if (value.length < PASSWORD_POLICY.minLength) {
    return {
      valid: false,
      code: 'min_length',
      message: `Le mot de passe doit contenir au moins ${PASSWORD_POLICY.minLength} caractères`,
    };
  }
  if (PASSWORD_POLICY.requiresUppercase && !/[A-Z]/.test(value)) {
    return {
      valid: false,
      code: 'uppercase',
      message: 'Le mot de passe doit contenir au moins une majuscule',
    };
  }
  if (PASSWORD_POLICY.requiresDigit && !/[0-9]/.test(value)) {
    return {
      valid: false,
      code: 'digit',
      message: 'Le mot de passe doit contenir au moins un chiffre',
    };
  }
  return { valid: true, code: null, message: null };
}

module.exports = {
  PASSWORD_POLICY,
  hashAuthActionToken,
  normalizeAuthActionToken,
  validatePasswordPolicy,
};
