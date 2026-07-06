/**
 * Auth partagée des endpoints déclenchés par Cloud Scheduler / Cloud Tasks.
 *
 * Le secret `SCHEDULER_SECRET` est accepté via l'en-tête dédié
 * `x-scheduler-secret` ou `Authorization: Bearer <secret>`, comparé en
 * timing-safe. Fail-closed : si le secret n'est pas configuré, on refuse (503)
 * plutôt que de laisser l'endpoint ouvert.
 *
 * NB : la présence seule d'un `Bearer` ne vaut PAS authentification. Tant que
 * l'ingress Cloud Run reste public, un token OIDC non vérifié n'est pas une
 * preuve — il faudrait passer l'ingress en interne et vérifier réellement le
 * token (verifyIdToken) pour s'appuyer sur l'IAM.
 */
const crypto = require('crypto');

function timingSafeSecretEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) {
    // Comparaison factice de longueur égale pour ne pas court-circuiter le timing.
    try { crypto.timingSafeEqual(ba, Buffer.alloc(ba.length)); } catch (_) {}
    return false;
  }
  try { return crypto.timingSafeEqual(ba, bb); } catch (_) { return false; }
}

// Retourne { ok: true } ou { ok: false, status, message } — le routeur applique
// le statut tel quel.
function checkSchedulerAuth(req) {
  const schedulerSecret = typeof process.env.SCHEDULER_SECRET === 'string'
    ? process.env.SCHEDULER_SECRET.trim()
    : '';
  if (!schedulerSecret) {
    return { ok: false, status: 503, message: 'Scheduler non configuré' };
  }
  const hdr = req.headers['x-scheduler-secret'] || req.headers['authorization'];
  const raw = Array.isArray(hdr) ? hdr[0] : hdr;
  const provided = typeof raw === 'string' ? raw.replace(/^Bearer /i, '').trim() : '';
  if (!timingSafeSecretEqual(provided, schedulerSecret)) {
    return { ok: false, status: 401, message: 'Non autorisé' };
  }
  return { ok: true };
}

module.exports = { timingSafeSecretEqual, checkSchedulerAuth };
