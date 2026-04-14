const test = require('node:test');
const assert = require('node:assert/strict');

const { hashAuthActionToken, normalizeAuthActionToken, validatePasswordPolicy } = require('../../domains/auth/security');
const { computeAccountAccessState, evaluateAuthenticatedAccess } = require('../../domains/billing/access-state');
const { getPlanCapabilitiesForApi } = require('../../lib/plan-limits');

test('authenticated smoke flow keeps auth, billing and plan contracts aligned', () => {
  const resetToken = normalizeAuthActionToken('  invite-token  ');
  const hashedToken = hashAuthActionToken(resetToken);
  const passwordValidation = validatePasswordPolicy('StrongPass1');
  const accessState = computeAccountAccessState({
    billingStatus: 'active',
    trialEndsAt: '2026-05-01T00:00:00.000Z',
    now: new Date('2026-04-11T00:00:00.000Z').getTime(),
  });
  const gate = evaluateAuthenticatedAccess({
    accountId: 'acc_1',
    path: '/api/v1/dashboard/overview',
    isStaff: false,
    accessState,
  });
  const capabilities = getPlanCapabilitiesForApi('PROFESSIONAL', false, 5);

  assert.equal(hashedToken.length, 64);
  assert.deepEqual(passwordValidation, { valid: true, code: null, message: null });
  assert.deepEqual(gate, { allowed: true });
  assert.equal(capabilities.features.aiEnrichment, true);
  assert.equal(capabilities.limits.maxChannels, 5);
});
