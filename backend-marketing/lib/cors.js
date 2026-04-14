/**
 * CORS — source unique pour les origines et la logique.
 * Utilisé par le handler HTTP (avant Express) et par le middleware Express.
 * Ne pas ajouter de app.use() avant le middleware CORS dans server-minimal.js.
 */

const CORS_ORIGINS_ENV = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  'https://app.feedplug.com',
  'https://feedplug.com',
  'https://www.feedplug.com',
  'https://feedplug-frontend-771607738477.europe-west1.run.app',
];

const origins = CORS_ORIGINS_ENV.length > 0 ? CORS_ORIGINS_ENV : DEFAULT_ORIGINS;

if (process.env.NODE_ENV !== 'production') {
  origins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002');
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  const o = origin.toLowerCase();
  if (origins.some(allowed => allowed.toLowerCase() === o)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === 'feedplug.com' || u.hostname.endsWith('.feedplug.com')) return true;
    // Note: ne pas autoriser *.run.app génériquement — l'URL Cloud Run spécifique est déjà dans DEFAULT_ORIGINS
  } catch (_) {}
  return false;
}

function setCorsHeaders(res, origin) {
  if (!origin || !isOriginAllowed(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Middleware CORS unique : OPTIONS → 204, autres → headers + next().
 * DOIT rester le premier app.use() dans run() — aucun middleware avant.
 */
function corsMiddleware(req, res, next) {
  const origin = (req.headers.origin || '').trim();
  setCorsHeaders(res, origin);

  const isPreflight = (req.method || '').toUpperCase() === 'OPTIONS' || req.headers['access-control-request-method'];
  if (isPreflight) {
    return res.status(204).end();
  }
  next();
}

module.exports = {
  isOriginAllowed,
  setCorsHeaders,
  corsMiddleware,
  getOrigins: () => origins.slice(),
};
