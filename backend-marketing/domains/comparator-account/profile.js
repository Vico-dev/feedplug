'use strict';

/**
 * domains/comparator-account/profile.js — Profil du COMPTE conso du comparateur.
 *
 * Surface : lecture/édition du prénom (+ nom optionnel), pays préféré, consentement
 * marketing ; suppression RGPD du compte (status='deleted' + purge des données liées).
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe` / `$executeRawUnsafe`
 * (params typés `$1::text`), colonnes minuscules, `prisma` injecté en 1er argument.
 * Les helpers de sanitisation sont PURS (testables sans DB).
 *
 * ⚠️ Périmètre : ce module ne touche QUE l'identité (prénom/nom), le pays préféré,
 * l'opt-in marketing et la suppression de compte. Il ne touche PAS l'onboarding,
 * les intérêts (ComparatorInterest) ni les données socio-démo/affinité.
 */

const FIRSTNAME_MAX = 80;
const LASTNAME_MAX = 80;

/** Trim + borne une chaîne de nom ; renvoie null si vide. Effondre les espaces internes. PUR. */
function sanitizeName(raw, max) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

/** Normalise un code pays ISO-2 ; défaut 'FR' si invalide. PUR. */
function normCountry(raw) {
  return typeof raw === 'string' && /^[A-Za-z]{2}$/.test(raw.trim())
    ? raw.trim().toUpperCase()
    : 'FR';
}

/**
 * Construit le patch de mise à jour à partir d'un body client (PUR, sans DB).
 * Ne renvoie QUE les champs présents (sémantique PATCH partielle), normalisés.
 * - firstname / lastname : sanitisés (null si vide → on autorise l'effacement explicite)
 * - countrycode : normalisé ISO-2
 * - marketingoptin : booléen strict
 * @param {Record<string, unknown>} body
 * @returns {{ firstname?: string|null, lastname?: string|null, countrycode?: string, marketingoptin?: boolean }}
 */
function buildProfilePatch(body) {
  const b = body && typeof body === 'object' ? body : {};
  const patch = {};
  if ('firstName' in b) patch.firstname = sanitizeName(b.firstName, FIRSTNAME_MAX);
  if ('lastName' in b) patch.lastname = sanitizeName(b.lastName, LASTNAME_MAX);
  if ('countryCode' in b) patch.countrycode = normCountry(b.countryCode);
  if ('marketingOptIn' in b) patch.marketingoptin = b.marketingOptIn === true;
  return patch;
}

/** Mappe une ligne DB (colonnes minuscules) vers la forme API (camelCase). PUR. */
function toApiProfile(row) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstname || null,
    lastName: row.lastname || null,
    countryCode: row.countrycode,
    locale: row.locale,
    marketingOptIn: row.marketingoptin === true,
  };
}

/** Récupère le profil d'un user conso actif. Retourne la forme API ou null. */
async function getProfile(prisma, userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, email, firstname, lastname, countrycode, locale, marketingoptin
     FROM "ComparatorUser"
     WHERE id = $1::text AND status <> 'deleted'
     LIMIT 1`,
    userId,
  );
  return rows && rows[0] ? toApiProfile(rows[0]) : null;
}

/**
 * Met à jour partiellement le profil. Construit dynamiquement le SET selon les champs fournis.
 * Met à jour consentat quand l'opt-in passe à true. Retourne le profil rafraîchi (ou null).
 */
async function updateProfile(prisma, userId, body) {
  const patch = buildProfilePatch(body);
  const sets = [];
  const params = [];
  let i = 1;

  if ('firstname' in patch) { sets.push(`firstname = $${i}::text`); params.push(patch.firstname); i += 1; }
  if ('lastname' in patch) { sets.push(`lastname = $${i}::text`); params.push(patch.lastname); i += 1; }
  if ('countrycode' in patch) { sets.push(`countrycode = $${i}::text`); params.push(patch.countrycode); i += 1; }
  if ('marketingoptin' in patch) {
    sets.push(`marketingoptin = $${i}::boolean`);
    params.push(patch.marketingoptin);
    i += 1;
    // Trace la date de consentement la première fois qu'il passe à true.
    if (patch.marketingoptin === true) sets.push(`consentat = COALESCE(consentat, now())`);
  }

  if (sets.length > 0) {
    sets.push('updatedat = now()');
    const idParam = `$${i}::text`;
    params.push(userId);
    await prisma.$executeRawUnsafe(
      `UPDATE "ComparatorUser" SET ${sets.join(', ')} WHERE id = ${idParam} AND status <> 'deleted'`,
      ...params,
    );
  }

  return getProfile(prisma, userId);
}

/**
 * Suppression RGPD : marque le compte 'deleted', anonymise l'e-mail/identité, révoque les
 * sessions et purge les données rattachées (intérêts, watchlist) + magic-links en attente.
 * Idempotent. Retourne true si un compte actif a été supprimé.
 *
 * NB : on garde la ligne ComparatorUser (status='deleted') pour l'intégrité référentielle /
 * l'audit, mais sans donnée personnelle exploitable. L'e-mail est remplacé par une valeur
 * opaque pour libérer l'unicité (un futur ré-inscription avec le même e-mail recrée un compte).
 */
async function deleteAccount(prisma, userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM "ComparatorUser" WHERE id = $1::text AND status <> 'deleted' LIMIT 1`,
    userId,
  );
  if (!rows || !rows[0]) return false;

  // Purge des données liées (best-effort : ces tables peuvent ne pas exister selon l'env).
  for (const stmt of [
    `DELETE FROM "ComparatorInterest" WHERE userid = $1::text`,
    `DELETE FROM "ComparatorProfile" WHERE userid = $1::text`,
    `DELETE FROM "ComparatorBrandAffinity" WHERE userid = $1::text`,
    `DELETE FROM "ComparatorSession" WHERE userid = $1::text`,
    `DELETE FROM "ComparatorWatchlist" WHERE userid = $1::text`,
    `DELETE FROM "ComparatorMagicLink" WHERE lower(email) = (SELECT lower(email) FROM "ComparatorUser" WHERE id = $1::text)`,
  ]) {
    try { await prisma.$executeRawUnsafe(stmt, userId); }
    catch (e) { /* table absente / FK : on continue la purge RGPD */ void e; }
  }

  // Anonymisation + tombstone. L'e-mail devient opaque pour libérer l'index unique.
  await prisma.$executeRawUnsafe(
    `UPDATE "ComparatorUser"
     SET status = 'deleted',
         email = 'deleted+' || id || '@deleted.invalid',
         emailverified = false,
         firstname = NULL,
         lastname = NULL,
         marketingoptin = false,
         updatedat = now()
     WHERE id = $1::text`,
    userId,
  );
  return true;
}

module.exports = {
  FIRSTNAME_MAX,
  LASTNAME_MAX,
  sanitizeName,
  normCountry,
  buildProfilePatch,
  toApiProfile,
  getProfile,
  updateProfile,
  deleteAccount,
};
