'use strict';

/**
 * domains/comparator-account/interests.js — Intérêts (catégories suivies) d'un user conso.
 *
 * Set COMPLET remplaçable : PUT remplace l'intégralité des catégories suivies.
 * Logique pure / accès DB ici ; les routes ne font que du HTTP.
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe` / `$executeRawUnsafe`
 * (params typés), colonnes minuscules, `prisma` injecté en 1er argument.
 * `sanitizeCategoryIds` est PUR (testable sans DB).
 */

/**
 * Nettoie une liste d'ids de catégories venant du client.
 * Garde les chaînes slug plausibles (a-z0-9-), dédoublonne, borne à 50. PUR.
 * @param {unknown} raw
 * @returns {string[]}
 */
function sanitizeCategoryIds(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const id = v.trim().toLowerCase();
    if (!id || id.length > 64 || !/^[a-z0-9-]+$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 50) break;
  }
  return out;
}

/** Retourne les ids de catégories suivies par l'user (ascendant par position de la taxonomie). */
async function getInterests(prisma, userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ci.categoryid
     FROM "ComparatorInterest" ci
     LEFT JOIN "ComparatorCategory" cc ON cc.id = ci.categoryid
     WHERE ci.userid = $1::text
     ORDER BY COALESCE(cc.position, 999) ASC, ci.categoryid ASC`,
    userId,
  );
  return rows.map((r) => r.categoryid);
}

/**
 * Remplace l'ENSEMBLE des intérêts de l'user par `categoryIds`.
 * Ne garde que des catégories existantes et actives (intégrité référentielle applicative).
 * Idempotent. Retourne la liste effectivement enregistrée.
 */
async function setInterests(prisma, userId, categoryIds) {
  const wanted = sanitizeCategoryIds(categoryIds);
  // Filtre sur la taxonomie réelle (catégories actives) pour éviter d'enregistrer des ids fantômes.
  let valid = [];
  if (wanted.length > 0) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "ComparatorCategory" WHERE active = true AND id = ANY($1::text[])`,
      wanted,
    );
    const allowed = new Set(rows.map((r) => r.id));
    valid = wanted.filter((id) => allowed.has(id));
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "ComparatorInterest" WHERE userid = $1::text`, userId);
  for (const categoryId of valid) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ComparatorInterest" (userid, categoryid, createdat)
       VALUES ($1::text, $2::text, now())
       ON CONFLICT (userid, categoryid) DO NOTHING`,
      userId, categoryId,
    );
  }
  return valid;
}

module.exports = { sanitizeCategoryIds, getInterests, setInterests };
