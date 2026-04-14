const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBillingRequiredResponse,
  computeAccountAccessState,
  evaluateAuthenticatedAccess,
  isBillingExemptPath,
  isPendingGraceExpired,
} = require('../../domains/billing/access-state');

test('computeAccountAccessState blocks pending accounts after grace period', () => {
  const now = new Date('2026-04-12T10:00:00.000Z').getTime();
  const accessState = computeAccountAccessState({
    billingStatus: 'pending',
    paymentGraceUntil: '2026-04-12T09:00:00.000Z',
    trialEndsAt: null,
    now,
  });

  assert.equal(accessState.isBlocked, true);
  assert.equal(accessState.billingStatus, 'pending');
});

test('computeAccountAccessState allows active trial accounts', () => {
  const now = new Date('2026-04-12T10:00:00.000Z').getTime();
  const accessState = computeAccountAccessState({
    billingStatus: 'active',
    paymentGraceUntil: null,
    trialEndsAt: '2026-04-20T10:00:00.000Z',
    now,
  });

  assert.equal(accessState.isBlocked, false);
});

test('evaluateAuthenticatedAccess bypasses billing checks for exempt paths and staff', () => {
  const blockedState = computeAccountAccessState({
    billingStatus: 'pending',
    paymentGraceUntil: '2026-04-12T09:00:00.000Z',
    now: new Date('2026-04-12T10:00:00.000Z').getTime(),
  });

  assert.equal(isBillingExemptPath('/api/v1/account/company-info'), true);
  assert.deepEqual(
    evaluateAuthenticatedAccess({
      accountId: 'acc_1',
      path: '/api/v1/account/company-info',
      isStaff: false,
      accessState: blockedState,
    }),
    { allowed: true }
  );
  assert.deepEqual(
    evaluateAuthenticatedAccess({
      accountId: 'acc_1',
      path: '/api/v1/catalogue',
      isStaff: true,
      accessState: blockedState,
    }),
    { allowed: true }
  );
});

test('evaluateAuthenticatedAccess returns a blocking payload for suspended accounts', () => {
  const blockedState = computeAccountAccessState({
    billingStatus: 'payment_failed',
    paymentGraceUntil: '2026-04-12T09:00:00.000Z',
    now: new Date('2026-04-12T10:00:00.000Z').getTime(),
  });

  const result = evaluateAuthenticatedAccess({
    accountId: 'acc_1',
    path: '/api/v1/catalogue',
    isStaff: false,
    accessState: blockedState,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, 402);
  assert.deepEqual(result.body, buildBillingRequiredResponse(blockedState));
  assert.equal(
    isPendingGraceExpired({
      billingstatus: 'payment_failed',
      paymentgraceuntil: '2026-04-12T09:00:00.000Z',
    }, new Date('2026-04-12T10:00:00.000Z').getTime()),
    true
  );
});
