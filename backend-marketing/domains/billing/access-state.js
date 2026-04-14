const BILLING_EXEMPT_PREFIXES = Object.freeze([
  '/api/v1/auth/me',
  '/api/v1/billing',
  '/api/v1/onboarding',
  '/api/v1/account/company-info',
]);

function normalizeBillingStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (status === 'pending' || status === 'active' || status === 'payment_failed') return status;
  return null;
}

function parseOptionalDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeAccountAccessState({ trialEndsAt, billingStatus, paymentGraceUntil, now = Date.now() }) {
  const normalizedTrialEndsAt = parseOptionalDate(trialEndsAt);
  const normalizedBillingStatus = normalizeBillingStatus(billingStatus);
  const normalizedPaymentGraceUntil = parseOptionalDate(paymentGraceUntil);
  const graceActive = !!normalizedPaymentGraceUntil && normalizedPaymentGraceUntil.getTime() > now;
  const trialActive = !!normalizedTrialEndsAt && normalizedTrialEndsAt.getTime() > now;
  const isBlocked = normalizedBillingStatus === 'pending' || normalizedBillingStatus === 'payment_failed'
    ? !graceActive
    : (!trialActive && !!normalizedTrialEndsAt);

  return {
    trialEndsAt: normalizedTrialEndsAt,
    billingStatus: normalizedBillingStatus,
    paymentGraceUntil: normalizedPaymentGraceUntil,
    isBlocked,
  };
}

function mapAccountRowToAccessState(accountRow, now = Date.now()) {
  return computeAccountAccessState({
    trialEndsAt: accountRow?.trialendsat ?? accountRow?.trialEndsAt,
    billingStatus: accountRow?.billingstatus ?? accountRow?.billingStatus,
    paymentGraceUntil: accountRow?.paymentgraceuntil ?? accountRow?.paymentGraceUntil,
    now,
  });
}

function isPendingGraceExpired(accountRow, now = Date.now()) {
  const accessState = mapAccountRowToAccessState(accountRow, now);
  return (accessState.billingStatus === 'pending' || accessState.billingStatus === 'payment_failed') && accessState.isBlocked;
}

function isBillingExemptPath(pathOrRequest) {
  const path = typeof pathOrRequest === 'string'
    ? pathOrRequest
    : String(pathOrRequest?.originalUrl || pathOrRequest?.path || '').split('?')[0];
  return BILLING_EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildBillingRequiredResponse(accessState) {
  return {
    message: accessState.billingStatus === 'pending' || accessState.billingStatus === 'payment_failed'
      ? 'Paiement en attente. Finalisez ou régularisez votre abonnement pour réactiver l’accès.'
      : 'Votre accès est suspendu. Choisissez un plan pour continuer.',
    code: 'BILLING_REQUIRED',
    trialEndsAt: accessState.trialEndsAt ? accessState.trialEndsAt.toISOString() : null,
    billingStatus: accessState.billingStatus,
    paymentGraceUntil: accessState.paymentGraceUntil ? accessState.paymentGraceUntil.toISOString() : null,
  };
}

function evaluateAuthenticatedAccess({ accountId, path, isStaff, accessState }) {
  if (!accountId || isStaff || isBillingExemptPath(path)) {
    return { allowed: true };
  }
  if (!accessState?.isBlocked) {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 402,
    body: buildBillingRequiredResponse(accessState),
  };
}

module.exports = {
  BILLING_EXEMPT_PREFIXES,
  buildBillingRequiredResponse,
  computeAccountAccessState,
  evaluateAuthenticatedAccess,
  isBillingExemptPath,
  isPendingGraceExpired,
  mapAccountRowToAccessState,
  normalizeBillingStatus,
  parseOptionalDate,
};
