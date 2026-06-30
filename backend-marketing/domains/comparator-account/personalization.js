'use strict';

/**
 * domains/comparator-account/personalization.js — Onboarding enrichi + perso de l'UX conso.
 *
 * Couvre :
 *   - le PROFIL socio-démographique (RGPD, optionnel + consenti) : ComparatorProfile,
 *   - l'AFFINITÉ marques (set complet remplaçable) : ComparatorBrandAffinity,
 *   - la PERSONNALISATION du ranking (pondération catégories suivies + marques favorites),
 *   - la section « Recommandé pour toi » (produits des catégories/marques affines).
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe`/`$executeRawUnsafe`
 * (params typés), colonnes minuscules, `prisma` injecté en 1er argument. Toutes les
 * fonctions de validation/scoring sont PURES (testables sans DB).
 *
 * RGPD : `sanitizeDemographics` ne garde que des valeurs d'une liste blanche fermée ; on ne
 * stocke jamais d'identifiant direct ni d'IP. `consentat` n'est posé que si le client confirme
 * explicitement le consentement à la finalité personnalisation ; sinon il est remis à NULL et
 * la perso retombe sur les seuls intérêts (catégories), jamais bloquant.
 */

// Listes blanches fermées (toute valeur hors-liste est ignorée → NULL).
const AGE_RANGES = new Set(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']);
const GENDERS = new Set(['f', 'h', 'autre', 'nsp']);
const HOUSEHOLDS = new Set(['seul', 'couple', 'famille', 'coloc', 'autre']);
const BUDGET_RANGES = new Set(['eco', 'moyen', 'premium']);

/** Région/département FR : 2–6 caractères a-z0-9 (ex. 'idf', '75', '2a'). Sinon null. PUR. */
function sanitizeRegion(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (!v || v.length > 6 || !/^[a-z0-9-]+$/.test(v)) return null;
  return v;
}

function pickEnum(raw, allowed) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return allowed.has(v) ? v : null;
}

/**
 * Nettoie un payload socio-démo. Toute valeur invalide/absente → null (jamais d'erreur).
 * PUR. Retourne un objet aux 5 champs (+ consent booléen normalisé).
 * @param {unknown} raw
 * @returns {{ agerange:string|null, gender:string|null, region:string|null,
 *             household:string|null, budgetrange:string|null, consent:boolean }}
 */
function sanitizeDemographics(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    agerange: pickEnum(o.agerange, AGE_RANGES),
    gender: pickEnum(o.gender, GENDERS),
    region: sanitizeRegion(o.region),
    household: pickEnum(o.household, HOUSEHOLDS),
    budgetrange: pickEnum(o.budgetrange, BUDGET_RANGES),
    consent: o.consent === true || o.consent === 'true',
  };
}

/**
 * Nettoie une liste de marques favorites. Trim, minuscule, dédoublonne, borne à 30. PUR.
 * @param {unknown} raw
 * @returns {string[]}
 */
function sanitizeBrands(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const b = v.trim().toLowerCase();
    if (!b || b.length > 80) continue;
    if (seen.has(b)) continue;
    seen.add(b);
    out.push(b);
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * Bonus d'affinité d'un produit, PUR. Sert à pondérer le ranking : plus c'est NÉGATIF,
 * plus le produit est remonté (cohérent avec scoreDrop du feed, où négatif = en tête).
 * +1 niveau si la marque est favorite. (Les catégories sont déjà garanties par le JOIN
 * sur les intérêts ; on n'ajoute donc un bonus que pour la marque ici.)
 * @param {string|null} brand        marque du produit
 * @param {Set<string>} favoriteBrands marques favorites (déjà normalisées minuscule)
 * @param {number} [weight=12]        amplitude du bonus (en points de %)
 * @returns {number} <= 0
 */
function affinityBonus(brand, favoriteBrands, weight = 12) {
  if (!brand || !(favoriteBrands instanceof Set) || favoriteBrands.size === 0) return 0;
  return favoriteBrands.has(String(brand).trim().toLowerCase()) ? -Math.abs(weight) : 0;
}

// ───────── Accès DB : profil socio-démo ─────────

/** Retourne le profil socio-démo de l'user, ou un objet à null si absent. */
async function getDemographics(prisma, userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT agerange, gender, region, household, budgetrange, consentat
     FROM "ComparatorProfile" WHERE userid = $1::text`,
    userId,
  );
  const r = rows[0];
  return {
    agerange: r?.agerange ?? null,
    gender: r?.gender ?? null,
    region: r?.region ?? null,
    household: r?.household ?? null,
    budgetrange: r?.budgetrange ?? null,
    consentAt: r?.consentat ? new Date(r.consentat).toISOString() : null,
  };
}

/**
 * Upsert du profil socio-démo. `consentat` n'est posé (now()) que si consent === true ;
 * sinon il est remis à NULL (retrait du consentement) — RGPD. Idempotent.
 * Retourne le profil tel qu'enregistré (via getDemographics).
 */
async function setDemographics(prisma, userId, raw) {
  const d = sanitizeDemographics(raw);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ComparatorProfile"
       (userid, agerange, gender, region, household, budgetrange, consentat, updatedat)
     VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text,
             CASE WHEN $7::boolean THEN now() ELSE NULL END, now())
     ON CONFLICT (userid) DO UPDATE SET
       agerange    = EXCLUDED.agerange,
       gender      = EXCLUDED.gender,
       region      = EXCLUDED.region,
       household   = EXCLUDED.household,
       budgetrange = EXCLUDED.budgetrange,
       consentat   = CASE WHEN $7::boolean THEN now() ELSE NULL END,
       updatedat   = now()`,
    userId, d.agerange, d.gender, d.region, d.household, d.budgetrange, d.consent,
  );
  return getDemographics(prisma, userId);
}

// ───────── Accès DB : affinité marques ─────────

/** Retourne les marques favorites de l'user (ordre alphabétique). */
async function getFavoriteBrands(prisma, userId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT brand FROM "ComparatorBrandAffinity" WHERE userid = $1::text ORDER BY brand ASC`,
    userId,
  );
  return rows.map((r) => r.brand);
}

/** Remplace l'ENSEMBLE des marques favorites par `brands`. Idempotent. Retourne la liste enregistrée. */
async function setFavoriteBrands(prisma, userId, brands) {
  const valid = sanitizeBrands(brands);
  await prisma.$executeRawUnsafe(`DELETE FROM "ComparatorBrandAffinity" WHERE userid = $1::text`, userId);
  for (const brand of valid) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ComparatorBrandAffinity" (userid, brand, createdat)
       VALUES ($1::text, $2::text, now())
       ON CONFLICT (userid, brand) DO NOTHING`,
      userId, brand,
    );
  }
  return valid;
}

// ───────── « Recommandé pour toi » (perso reco) ─────────

/**
 * Produits recommandés pour l'user : intersection catégories suivies, remontés par baisse
 * pondérée du bonus d'affinité marque. Réutilise la même mécanique de prix/gating que le feed.
 * Si aucun intérêt n'est défini, retourne []. Retourne { items }.
 * @param {string} country pays ISO-2 (déjà normalisé en amont)
 */
async function getRecommendations(prisma, accountId, userId, { country, limit = 8 }) {
  const lim = Math.min(24, Math.max(1, parseInt(limit, 10) || 8));
  const favorites = new Set(await getFavoriteBrands(prisma, userId));

  const rows = await prisma.$queryRawUnsafe(`
    WITH followed AS (
      SELECT categoryid FROM "ComparatorInterest" WHERE userid = $2::text
    ),
    groups AS (
      SELECT pgc.groupid
      FROM "ProductGroupCategory" pgc
      JOIN followed f ON f.categoryid = pgc.categoryid
    ),
    lowest AS (
      SELECT fi.groupid,
             min(fi.price) AS lowestprice,
             (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency,
             count(DISTINCT COALESCE(fi.customfields->>'merchant_id', f.sourceid)) AS merchant_count,
             max((NULLIF(fi.customfields->>'rrp_price',''))::numeric)  AS rrp_price,
             max((NULLIF(fi.customfields->>'base_price',''))::numeric) AS base_price
      FROM "FeedItem" fi
      JOIN "Feed" f        ON f.id = fi.feedid
      JOIN "FeedSource" fs ON fs.id = f.sourceid
      JOIN "Account" a     ON a.id = f.accountid
      JOIN groups g        ON g.groupid = fi.groupid
      WHERE fi.price > 0
        AND ((f.accountid = $1::text AND fs.approvalstatus = 'approved') OR a.comparatoroptin = true)
        AND COALESCE(fs.countrycode, '') = $3::text
      GROUP BY fi.groupid
    )
    SELECT pg.id, pg.canonicaltitle, pg.brand, pg.imageurl,
           pgc.categoryid,
           l.lowestprice, l.currency, l.merchant_count::int AS merchant_count,
           COALESCE(l.rrp_price, l.base_price) AS ref_price
    FROM "ProductGroup" pg
    JOIN lowest l ON l.groupid = pg.id
    JOIN "ProductGroupCategory" pgc ON pgc.groupid = pg.id
    WHERE pg.accountid = $1::text
    ORDER BY
      (
        COALESCE(CASE WHEN COALESCE(l.rrp_price, l.base_price) > 0
                      THEN (l.lowestprice - COALESCE(l.rrp_price, l.base_price)) / COALESCE(l.rrp_price, l.base_price) * 100 END, 0)
        + CASE WHEN lower(COALESCE(pg.brand,'')) = ANY($5::text[]) THEN -12 ELSE 0 END
      ) ASC,
      pg.updatedat DESC
    LIMIT $4::int
  `, accountId, userId, country, lim, Array.from(favorites));

  const items = rows.map((r) => {
    const current = r.lowestprice != null ? Number(r.lowestprice) : null;
    const ref = r.ref_price != null ? Number(r.ref_price) : null;
    const rrpDropPct = (ref && ref > 0 && current != null)
      ? Math.round(((current - ref) / ref) * 1000) / 10 : null;
    return {
      id: r.id,
      title: r.canonicaltitle,
      brand: r.brand,
      imageUrl: r.imageurl,
      categoryId: r.categoryid,
      lowestPrice: current,
      currency: r.currency,
      merchantCount: r.merchant_count,
      rrpDropPct,
      affinityBonus: affinityBonus(r.brand, favorites),
    };
  });
  return { items };
}

module.exports = {
  // pures
  sanitizeDemographics,
  sanitizeBrands,
  sanitizeRegion,
  affinityBonus,
  AGE_RANGES,
  GENDERS,
  HOUSEHOLDS,
  BUDGET_RANGES,
  // DB
  getDemographics,
  setDemographics,
  getFavoriteBrands,
  setFavoriteBrands,
  getRecommendations,
};
