'use strict';
// Magic-link conso : génération/vérification de jetons à usage unique.
// Le token brut n'est JAMAIS stocké — seul son sha256. Single-use atomique via UPDATE…RETURNING.
const crypto = require('crypto');

const TOKEN_TTL_MS = 15 * 60 * 1000;     // 15 min
const THROTTLE_WINDOW = "interval '10 minutes'";
const THROTTLE_MAX = 5;                   // max liens / email / 10 min

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}
function generateToken() {
  return crypto.randomBytes(32).toString('base64url'); // 256 bits
}
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
function isValidEmail(raw) {
  const e = normalizeEmail(raw);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Crée un magic-link. Retourne { token } (brut, à e-mailer) ou { throttled: true }. */
async function createMagicLink(prisma, { email, purpose = 'login', ipHash = null }) {
  const e = normalizeEmail(email);
  const recent = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "ComparatorMagicLink"
     WHERE lower(email) = $1::text AND createdat > now() - ${THROTTLE_WINDOW}`,
    e,
  );
  if (recent[0] && recent[0].n >= THROTTLE_MAX) return { throttled: true };

  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ComparatorMagicLink" (id, email, tokenhash, purpose, expiresat, iphash, createdat)
     VALUES ($1::text, $2::text, $3::text, $4::text, $5::timestamptz, $6::text, now())`,
    crypto.randomUUID(), e, hashToken(token), purpose, expires, ipHash,
  );
  return { token };
}

/** Consomme un magic-link de façon atomique (single-use). Retourne { email, purpose } ou null. */
async function verifyMagicLink(prisma, rawToken) {
  if (!rawToken) return null;
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "ComparatorMagicLink" SET consumedat = now()
     WHERE tokenhash = $1::text AND consumedat IS NULL AND expiresat > now()
     RETURNING email, purpose`,
    hashToken(rawToken),
  );
  return rows && rows[0] ? { email: normalizeEmail(rows[0].email), purpose: rows[0].purpose } : null;
}

module.exports = {
  TOKEN_TTL_MS,
  THROTTLE_MAX,
  normalizeEmail,
  generateToken,
  hashToken,
  isValidEmail,
  createMagicLink,
  verifyMagicLink,
};
