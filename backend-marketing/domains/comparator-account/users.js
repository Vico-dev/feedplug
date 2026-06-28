'use strict';
// Find-or-create d'un utilisateur conso (email vérifié par le magic-link consommé).
const crypto = require('crypto');
const { normalizeEmail } = require('./magic-link');

async function findOrCreateUser(prisma, { email, countryCode = 'FR', locale = 'fr' }) {
  const e = normalizeEmail(email);
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id, email, countrycode, locale, emailverified, marketingoptin, status
     FROM "ComparatorUser" WHERE lower(email) = $1::text LIMIT 1`,
    e,
  );
  if (existing && existing[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ComparatorUser" SET emailverified = true, lastloginat = now(), updatedat = now() WHERE id = $1::text`,
      existing[0].id,
    );
    return existing[0];
  }
  const id = crypto.randomUUID();
  const cc = /^[A-Za-z]{2}$/.test(countryCode) ? countryCode.toUpperCase() : 'FR';
  const loc = /^[a-z]{2}$/.test(locale) ? locale : 'fr';
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ComparatorUser" (id, email, emailverified, countrycode, locale, status, lastloginat, createdat, updatedat)
     VALUES ($1::text, $2::text, true, $3::text, $4::text, 'active', now(), now(), now())`,
    id, e, cc, loc,
  );
  return { id, email: e, countrycode: cc, locale: loc, emailverified: true, marketingoptin: false, status: 'active' };
}

module.exports = { findOrCreateUser };
