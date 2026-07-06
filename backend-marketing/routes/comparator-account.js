'use strict';
// Routes AUTH CONSO du comparateur (magic-link). Namespace /api/v1/comparator/account/*.
// Population strictement séparée du B2B : aucun accountId, middleware distinct de authenticateToken.
// Toute la logique vit dans domains/comparator-account/* ; ici uniquement le HTTP.
const crypto = require('crypto');
const {
  createMagicLink,
  verifyMagicLink,
  isValidEmail,
  normalizeEmail,
} = require('../domains/comparator-account/magic-link');
const { createSession, verifySession, revokeSession, SESSION_TTL_MS } = require('../domains/comparator-account/sessions');
const { findOrCreateUser } = require('../domains/comparator-account/users');
const { isOriginAllowed } = require('../lib/cors');

const COOKIE = 'cmp_session';

// Le cookie de session conso est SameSite=None (pages feedplug.com → API *.run.app
// en cross-site), donc un site tiers peut déclencher une mutation authentifiée par
// CSRF. Défense : sur une méthode mutante, si un en-tête Origin est présent mais hors
// allowlist FeedPlug, on refuse. Origin absent (app native, sans notion d'origine
// navigateur) → laissé passer : la CSRF suppose un navigateur qui joint le cookie et
// envoie toujours Origin sur une mutation cross-site.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
function isCsrfBlocked(req) {
  if (!MUTATING_METHODS.has(String(req.method || '').toUpperCase())) return false;
  const origin = (req.headers && req.headers.origin || '').trim();
  if (!origin) return false;
  return !isOriginAllowed(origin);
}

function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 32);
}
function clientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.ip || null;
}
function cookieOptions() {
  // En prod, les pages compte (feedplug.com) appellent l'API backend (*.run.app) en
  // cross-site → le cookie doit être SameSite=None; Secure pour être envoyé en fetch.
  // En dev (http localhost, ports ≠), Lax suffit et None;Secure serait rejeté sans https.
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

/** Fabrique un middleware d'auth conso réutilisable par les futurs modules de routes (watchlist, intérêts…). */
function makeRequireComparatorAuth({ getPrisma, getPrismaReady }) {
  return async function requireComparatorAuth(req, res, next) {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) return res.status(503).json({ message: 'Service indisponible' });
    if (isCsrfBlocked(req)) return res.status(403).json({ message: 'Origine non autorisée' });
    try {
      const sess = await verifySession(prisma, req.cookies && req.cookies[COOKIE]);
      if (!sess) return res.status(401).json({ message: 'Non authentifié' });
      req.comparatorUser = { id: sess.userId };
      return next();
    } catch (e) {
      console.error('[comparator-account] auth error:', e.message);
      return res.status(500).json({ message: 'Erreur authentification' });
    }
  };
}

function registerComparatorAccountRoutes(app, { getPrisma, getPrismaReady, sendMagicLinkEmail }) {
  const requireComparatorAuth = makeRequireComparatorAuth({ getPrisma, getPrismaReady });
  const ready = (res) => {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) { res.status(503).json({ message: 'Service indisponible' }); return null; }
    return prisma;
  };

  // Demande d'un lien de connexion. Réponse TOUJOURS générique (anti-énumération de comptes).
  app.post('/api/v1/comparator/account/magic-link', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return res.status(400).json({ message: 'E-mail invalide' });
      const locale = typeof body.locale === 'string' && /^[a-z]{2}$/.test(body.locale) ? body.locale : 'fr';
      const result = await createMagicLink(prisma, { email, purpose: 'login', ipHash: hashIp(clientIp(req)) });
      if (!result.throttled && typeof sendMagicLinkEmail === 'function') {
        try { await sendMagicLinkEmail(email, result.token, locale); }
        catch (e) { console.error('[comparator-account] email send error:', e.message); }
      }
      return res.status(200).json({ message: "Si un compte existe, un lien de connexion vient d'être envoyé." });
    } catch (e) {
      console.error('[comparator-account] magic-link error:', e);
      return res.status(500).json({ message: 'Erreur' });
    }
  });

  // Vérifie le token (single-use), crée/retrouve l'user, ouvre une session (cookie HttpOnly).
  app.post('/api/v1/comparator/account/verify', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      const token = typeof body.token === 'string' ? body.token : '';
      const consumed = await verifyMagicLink(prisma, token);
      if (!consumed) return res.status(400).json({ message: 'Lien invalide ou expiré' });
      const country = typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : 'FR';
      const locale = typeof body.locale === 'string' && /^[a-z]{2}$/.test(body.locale) ? body.locale : 'fr';
      const user = await findOrCreateUser(prisma, { email: consumed.email, countryCode: country, locale });
      const sessionToken = await createSession(prisma, user.id, {
        userAgent: req.headers && req.headers['user-agent'],
        ipHash: hashIp(clientIp(req)),
      });
      res.cookie(COOKIE, sessionToken, cookieOptions());
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          countryCode: user.countrycode,
          locale: user.locale,
          // Permet au client de proposer « Comment on t'appelle ? » quand le prénom manque.
          firstName: user.firstname || null,
        },
      });
    } catch (e) {
      console.error('[comparator-account] verify error:', e);
      return res.status(500).json({ message: 'Erreur' });
    }
  });

  app.post('/api/v1/comparator/account/logout', async (req, res) => {
    if (isCsrfBlocked(req)) return res.status(403).json({ message: 'Origine non autorisée' });
    const prisma = getPrisma();
    try { if (prisma) await revokeSession(prisma, req.cookies && req.cookies[COOKIE]); }
    catch (e) { console.error('[comparator-account] logout error:', e.message); }
    res.clearCookie(COOKIE, { path: '/' });
    return res.status(200).json({ message: 'Déconnecté' });
  });

  app.get('/api/v1/comparator/account/me', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, email, countrycode, locale, marketingoptin, firstname FROM "ComparatorUser" WHERE id = $1::text LIMIT 1`,
        req.comparatorUser.id,
      );
      if (!rows[0]) return res.status(404).json({ message: 'Introuvable' });
      const u = rows[0];
      return res.json({ id: u.id, email: u.email, countryCode: u.countrycode, locale: u.locale, marketingOptIn: u.marketingoptin, firstName: u.firstname || null });
    } catch (e) {
      console.error('[comparator-account] me error:', e.message);
      return res.status(500).json({ message: 'Erreur' });
    }
  });

  return { requireComparatorAuth };
}

module.exports = { registerComparatorAccountRoutes, makeRequireComparatorAuth, hashIp, cookieOptions, COOKIE, isCsrfBlocked };
