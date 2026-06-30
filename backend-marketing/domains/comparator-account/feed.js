'use strict';

/**
 * domains/comparator-account/feed.js — Feed perso « baisses » d'un user conso.
 *
 * Produits des catégories suivies (ComparatorInterest -> ProductGroupCategory -> ProductGroup),
 * triés par signal de baisse. Le signal v1 combine :
 *   - pctVs30d : variation du prix le plus bas vs ~30 j (ProductGroupPriceHistory),
 *   - rrpDropPct (proxy instantané) : écart au prix conseillé AWIN porté par customfields
 *     (rrp_price / base_price), s'il est présent — sinon ignoré (résout le cold-start
 *     tant que l'historique 30 j n'est pas accumulé).
 * Gating AWIN conservé (sources 'approved' / opt-in comparateur), comme routes/comparateur.js.
 *
 * Conventions du repo : SQL brut via `prisma.$queryRawUnsafe` (params typés), colonnes
 * minuscules, `prisma` injecté en 1er argument. `scoreDrop` est PUR (testable sans DB).
 */

/**
 * Score de « bon plan » : plus c'est NÉGATIF, plus la baisse est forte (donc en tête de feed).
 * Prend la meilleure (la plus négative) des deux baisses disponibles. PUR.
 * @param {number|null} pctVs30d   variation vs ~30 j (négatif = baisse)
 * @param {number|null} rrpDropPct écart au prix conseillé (négatif = sous le conseillé)
 * @returns {number} score (0 si aucun signal)
 */
function scoreDrop(pctVs30d, rrpDropPct) {
  const a = typeof pctVs30d === 'number' && !Number.isNaN(pctVs30d) ? pctVs30d : null;
  const b = typeof rrpDropPct === 'number' && !Number.isNaN(rrpDropPct) ? rrpDropPct : null;
  if (a == null && b == null) return 0;
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

/** Borne pagination : limit 1..48 (def 24), offset >= 0. PUR. */
function parsePaging(rawLimit, rawOffset) {
  const limit = Math.min(48, Math.max(1, parseInt(rawLimit, 10) || 24));
  const offset = Math.max(0, parseInt(rawOffset, 10) || 0);
  return { limit, offset };
}

/**
 * Construit le feed perso de l'user. Retourne { items, total }.
 * @param {string} country pays ISO-2 (déjà normalisé en amont)
 * @param {string[]} [favoriteBrands] marques favorites (affinité) — pondèrent le ranking.
 *   Optionnel : si absent/vide, le tri reste celui des baisses pures (rétro-compatible).
 */
async function getPersonalFeed(prisma, accountId, userId, { country, limit, offset, favoriteBrands = [] }) {
  const brands = Array.isArray(favoriteBrands)
    ? favoriteBrands.filter((b) => typeof b === 'string' && b).map((b) => b.trim().toLowerCase())
    : [];
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
    ),
    past AS (
      SELECT DISTINCT ON (h.groupid) h.groupid, h.lowestprice AS pastprice
      FROM "ProductGroupPriceHistory" h
      JOIN groups g ON g.groupid = h.groupid
      WHERE h.countrycode = $3::text
        AND h.capturedon <= (CURRENT_DATE - INTERVAL '30 days')
      ORDER BY h.groupid, h.capturedon DESC
    )
    SELECT pg.id, pg.canonicaltitle, pg.brand, pg.imageurl,
           pgc.categoryid,
           l.lowestprice, l.currency, l.merchant_count::int AS merchant_count,
           l.rrp_price, COALESCE(l.rrp_price, l.base_price) AS ref_price,
           p.pastprice,
           count(*) OVER()::int AS total
    FROM "ProductGroup" pg
    JOIN lowest l ON l.groupid = pg.id
    JOIN "ProductGroupCategory" pgc ON pgc.groupid = pg.id
    LEFT JOIN past p ON p.groupid = pg.id
    WHERE pg.accountid = $1::text
    ORDER BY
      (
        LEAST(
          COALESCE(CASE WHEN p.pastprice > 0 THEN (l.lowestprice - p.pastprice) / p.pastprice * 100 END, 0),
          COALESCE(CASE WHEN COALESCE(l.rrp_price, l.base_price) > 0
                        THEN (l.lowestprice - COALESCE(l.rrp_price, l.base_price)) / COALESCE(l.rrp_price, l.base_price) * 100 END, 0)
        )
        -- Affinité marque : bonus négatif (= remonte le produit) si la marque est favorite.
        + CASE WHEN lower(COALESCE(pg.brand,'')) = ANY($6::text[]) THEN -12 ELSE 0 END
      ) ASC,
      pg.updatedat DESC
    LIMIT $4::int OFFSET $5::int
  `, accountId, userId, country, limit, offset, brands);

  const total = rows[0]?.total ?? 0;
  const items = rows.map((r) => {
    const current = r.lowestprice != null ? Number(r.lowestprice) : null;
    const past = r.pastprice != null ? Number(r.pastprice) : null;
    const ref = r.ref_price != null ? Number(r.ref_price) : null;
    const pctVs30d = (past && past > 0 && current != null)
      ? Math.round(((current - past) / past) * 1000) / 10 : null;
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
      pctVs30d,
      rrpDropPct,
      dropScore: scoreDrop(pctVs30d, rrpDropPct),
    };
  });
  return { items, total };
}

module.exports = { scoreDrop, parsePaging, getPersonalFeed };
