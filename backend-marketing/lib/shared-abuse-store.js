const crypto = require('crypto');

const SHARED_RATE_LIMIT_SCOPE_API = 'api:v1';
const SHARED_RATE_LIMIT_SCOPE_AUTH_REQUEST = 'auth:sensitive';
const SHARED_RATE_LIMIT_SCOPE_AUTH_FAILURE = 'auth:login-failure';
const SHARED_RATE_LIMIT_SCOPE_REGISTER = 'auth:register';
const SHARED_RATE_LIMIT_SCOPE_MARKETING_EARLY_ACCESS = 'marketing:early-access';
const SHARED_RATE_LIMIT_SCOPE_MARKETING_AUDITS = 'marketing:audits';
const SHARED_RATE_LIMIT_SCOPE_MARKETING_FEATURE_IDEA = 'marketing:feature-idea';
const SHARED_RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_MAX_ATTEMPTS = 5;

function createSharedAbuseProtection({
  ensurePrismaReady,
  getPrisma,
  getClientIp,
  jwt,
  getJwtSecret,
  isPreflightRequest,
  isHealthRequest,
  normalizeAuthActionToken,
  hashAuthActionToken,
  migrationLabel = '031_shared_rate_limits.sql',
}) {
  let sharedRateLimitStorageReady = false;
  let sharedRateLimitInitPromise = null;
  let lastSharedRateLimitPruneAt = 0;

  function buildSharedRateLimitKey(scope, rawKey) {
    const normalizedScope = String(scope || '').trim().toLowerCase();
    const normalizedKey = String(rawKey || '').trim().toLowerCase() || 'unknown';
    return crypto.createHash('sha256').update(`${normalizedScope}:${normalizedKey}`).digest('hex');
  }

  function setSharedRateLimitHeaders(res, { max, hitCount, resetAt }) {
    if (!res || !max || !resetAt) return;
    const remaining = Math.max(0, max - Number(hitCount || 0));
    const retryAfterSeconds = Math.max(0, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(retryAfterSeconds));
    if (remaining === 0 && retryAfterSeconds > 0) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }
  }

  async function ensureSharedRateLimitStorage() {
    if (sharedRateLimitStorageReady) return true;
    if (!sharedRateLimitInitPromise) {
      sharedRateLimitInitPromise = (async () => {
        if (!(await ensurePrismaReady()) || !getPrisma()) {
          throw new Error('Prisma indisponible pour le store anti-abus partagé');
        }
        const prisma = getPrisma();
        const tables = await prisma.$queryRawUnsafe(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'shared_rate_limits'
          LIMIT 1
        `);
        if (!tables?.length) {
          throw new Error(`Migration ${migrationLabel} non appliquée. Le store anti-abus partagé est requis.`);
        }
        sharedRateLimitStorageReady = true;
        return true;
      })().catch((error) => {
        sharedRateLimitStorageReady = false;
        throw error;
      }).finally(() => {
        sharedRateLimitInitPromise = null;
      });
    }
    return sharedRateLimitInitPromise;
  }

  async function pruneExpiredSharedRateLimits() {
    const now = Date.now();
    if (now - lastSharedRateLimitPruneAt < SHARED_RATE_LIMIT_PRUNE_INTERVAL_MS) {
      return;
    }
    lastSharedRateLimitPruneAt = now;
    try {
      await ensureSharedRateLimitStorage();
      await getPrisma().$executeRawUnsafe(`
        DELETE FROM shared_rate_limits
        WHERE resetat <= NOW()
      `);
    } catch (error) {
      console.warn('Shared rate limit prune skipped:', error?.message || error);
    }
  }

  async function incrementSharedRateLimitCounter({ scope, rawKey, windowMs }) {
    await ensureSharedRateLimitStorage();
    const resetAt = new Date(Date.now() + Math.max(1000, Number(windowMs) || 0)).toISOString();
    const hashedKey = buildSharedRateLimitKey(scope, rawKey);
    const rows = await getPrisma().$queryRawUnsafe(`
      INSERT INTO shared_rate_limits (scope, ratelimitkey, hitcount, resetat, createdat, updatedat)
      VALUES ($1::text, $2::text, 1, $3::timestamptz, NOW(), NOW())
      ON CONFLICT (scope, ratelimitkey) DO UPDATE
      SET hitcount = CASE
            WHEN shared_rate_limits.resetat <= NOW() THEN 1
            ELSE shared_rate_limits.hitcount + 1
          END,
          resetat = CASE
            WHEN shared_rate_limits.resetat <= NOW() THEN $3::timestamptz
            ELSE shared_rate_limits.resetat
          END,
          updatedat = NOW()
      RETURNING hitcount, resetat
    `, scope, hashedKey, resetAt);
    await pruneExpiredSharedRateLimits();
    return rows?.[0] || { hitcount: 0, resetat: resetAt };
  }

  async function getSharedRateLimitStatus({ scope, rawKey }) {
    await ensureSharedRateLimitStorage();
    const hashedKey = buildSharedRateLimitKey(scope, rawKey);
    const rows = await getPrisma().$queryRawUnsafe(`
      SELECT hitcount, resetat
      FROM shared_rate_limits
      WHERE scope = $1::text
        AND ratelimitkey = $2::text
        AND resetat > NOW()
      LIMIT 1
    `, scope, hashedKey);
    return rows?.[0] || null;
  }

  async function resetSharedRateLimitCounter({ scope, rawKey }) {
    await ensureSharedRateLimitStorage();
    const hashedKey = buildSharedRateLimitKey(scope, rawKey);
    await getPrisma().$executeRawUnsafe(`
      DELETE FROM shared_rate_limits
      WHERE scope = $1::text
        AND ratelimitkey = $2::text
    `, scope, hashedKey);
  }

  function buildEmailAndIpRateLimitKey(req, emailValue) {
    const normalizedEmail = String(emailValue || '').trim().toLowerCase();
    const clientIp = getClientIp(req);
    return normalizedEmail ? `ip:${clientIp}:email:${normalizedEmail}` : `ip:${clientIp}`;
  }

  function getAuthenticatedRateLimitKey(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      if (token) {
        try {
          const decoded = jwt.verify(token, getJwtSecret());
          if (decoded && typeof decoded === 'object') {
            if (decoded.id) return `user:${decoded.id}`;
            if (decoded.email) return `user:${decoded.email}`;
            if (decoded.accountId) return `account:${decoded.accountId}`;
          }
        } catch (_) {
          // Fallback IP: token absent, expiré ou invalide.
        }
      }
    }
    return `ip:${getClientIp(req)}`;
  }

  function getAuthSensitiveRateLimitKey(req) {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email) return buildEmailAndIpRateLimitKey(req, email);
    const token = normalizeAuthActionToken(req.body?.token);
    if (token) return `ip:${getClientIp(req)}:token:${hashAuthActionToken(token)}`;
    return `ip:${getClientIp(req)}`;
  }

  function createSharedRateLimiter({
    scope,
    windowMs,
    max,
    message,
    keyGenerator,
    skip = () => false,
  }) {
    return async (req, res, next) => {
      try {
        if (skip(req)) return next();
        const rawKey = (keyGenerator ? keyGenerator(req) : null) || getClientIp(req);
        const state = await incrementSharedRateLimitCounter({ scope, rawKey, windowMs });
        setSharedRateLimitHeaders(res, {
          max,
          hitCount: Number(state.hitcount || 0),
          resetAt: state.resetat,
        });
        if (Number(state.hitcount || 0) > max) {
          return res.status(429).json({ message });
        }
        return next();
      } catch (error) {
        console.error(`Shared rate limiter "${scope}" error:`, error);
        return res.status(503).json({ message: 'Protection anti-abus temporairement indisponible' });
      }
    };
  }

  async function getLoginFailureStatus(clientIp) {
    const state = await getSharedRateLimitStatus({
      scope: SHARED_RATE_LIMIT_SCOPE_AUTH_FAILURE,
      rawKey: clientIp,
    });
    if (!state) {
      return { blocked: false, hitCount: 0, remainingTime: 0, resetAt: null };
    }
    const hitCount = Number(state.hitcount || 0);
    const remainingTime = Math.max(0, Math.ceil((new Date(state.resetat).getTime() - Date.now()) / 1000 / 60));
    return {
      blocked: hitCount >= LOGIN_FAILURE_MAX_ATTEMPTS,
      hitCount,
      remainingTime,
      resetAt: state.resetat,
    };
  }

  async function recordLoginFailure(clientIp) {
    return incrementSharedRateLimitCounter({
      scope: SHARED_RATE_LIMIT_SCOPE_AUTH_FAILURE,
      rawKey: clientIp,
      windowMs: LOGIN_FAILURE_WINDOW_MS,
    });
  }

  async function recordLoginSuccess(clientIp) {
    return resetSharedRateLimitCounter({
      scope: SHARED_RATE_LIMIT_SCOPE_AUTH_FAILURE,
      rawKey: clientIp,
    });
  }

  return {
    smartAuthLimiter: createSharedRateLimiter({
      scope: SHARED_RATE_LIMIT_SCOPE_AUTH_REQUEST,
      windowMs: 15 * 60 * 1000,
      max: 25,
      keyGenerator: (req) => getAuthSensitiveRateLimitKey(req),
      message: 'Trop de requêtes sensibles. Réessayez dans quelques minutes.',
    }),
    apiRateLimiter: createSharedRateLimiter({
      scope: SHARED_RATE_LIMIT_SCOPE_API,
      windowMs: 60 * 1000,
      max: 500,
      skip: (req) => isPreflightRequest(req) || isHealthRequest(req),
      keyGenerator: (req) => getAuthenticatedRateLimitKey(req),
      message: 'Trop de requêtes. Réessayez dans une minute.',
    }),
    registerLimiter: createSharedRateLimiter({
      scope: SHARED_RATE_LIMIT_SCOPE_REGISTER,
      windowMs: 60 * 60 * 1000,
      max: 3,
      keyGenerator: (req) => buildEmailAndIpRateLimitKey(req, req.body?.email),
      message: 'Trop de tentatives d\'inscription. Réessayez dans 1 heure.',
    }),
    marketingEarlyAccessLimiter: createSharedRateLimiter({
      scope: SHARED_RATE_LIMIT_SCOPE_MARKETING_EARLY_ACCESS,
      windowMs: 10 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => buildEmailAndIpRateLimitKey(req, req.body?.email),
      message: 'Trop de demandes d’accès. Réessayez dans quelques minutes.',
    }),
    marketingAuditLimiter: createSharedRateLimiter({
      scope: SHARED_RATE_LIMIT_SCOPE_MARKETING_AUDITS,
      windowMs: 15 * 60 * 1000,
      max: 3,
      keyGenerator: (req) => buildEmailAndIpRateLimitKey(req, req.body?.email),
      message: 'Trop de demandes d’audit. Réessayez dans quelques minutes.',
    }),
    marketingFeatureIdeaLimiter: createSharedRateLimiter({
      scope: SHARED_RATE_LIMIT_SCOPE_MARKETING_FEATURE_IDEA,
      windowMs: 60 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => buildEmailAndIpRateLimitKey(req, req.body?.email),
      message: 'Trop d’idées soumises depuis cette origine. Réessayez plus tard.',
    }),
    getLoginFailureStatus,
    recordLoginFailure,
    recordLoginSuccess,
  };
}

module.exports = {
  createSharedAbuseProtection,
  LOGIN_FAILURE_MAX_ATTEMPTS,
};
