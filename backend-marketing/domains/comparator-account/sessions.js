'use strict';
// Sessions conso : cookie opaque (hash en base), révocables, expiration 30 j.
const crypto = require('crypto');
const { generateToken, hashToken } = require('./magic-link');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 j

/** Crée une session et retourne le token brut (à poser en cookie). */
async function createSession(prisma, userId, { userAgent = null, ipHash = null } = {}) {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ComparatorSession" (id, userid, tokenhash, expiresat, useragent, iphash, createdat)
     VALUES ($1::text, $2::text, $3::text, $4::timestamptz, $5::text, $6::text, now())`,
    crypto.randomUUID(), userId, hashToken(token), expires,
    userAgent ? String(userAgent).slice(0, 400) : null, ipHash,
  );
  return token;
}

/** Vérifie un cookie de session. Retourne { userId } ou null (user actif + session valide). */
async function verifySession(prisma, rawCookie) {
  if (!rawCookie) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT u.id AS userid
     FROM "ComparatorSession" s
     JOIN "ComparatorUser" u ON u.id = s.userid
     WHERE s.tokenhash = $1::text AND s.revokedat IS NULL AND s.expiresat > now() AND u.status = 'active'
     LIMIT 1`,
    hashToken(rawCookie),
  );
  return rows && rows[0] ? { userId: rows[0].userid } : null;
}

async function revokeSession(prisma, rawCookie) {
  if (!rawCookie) return;
  await prisma.$executeRawUnsafe(
    `UPDATE "ComparatorSession" SET revokedat = now() WHERE tokenhash = $1::text AND revokedat IS NULL`,
    hashToken(rawCookie),
  );
}

module.exports = { SESSION_TTL_MS, createSession, verifySession, revokeSession };
