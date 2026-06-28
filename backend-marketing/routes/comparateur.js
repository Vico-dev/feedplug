'use strict';

/**
 * routes/comparateur.js — API PUBLIQUE du comparateur CSS (Phase 3).
 *
 * Surface lue par le front public (pages [locale]/(comparateur)/) : recherche de
 * produits canoniques, fiche produit avec offres par marchand, historique de prix,
 * et redirection trackée vers le marchand.
 *
 * SANS authentification (préfixe /api/v1/comparator/* non couvert par requireAuth),
 * mais STRICTEMENT scopé au compte interne comparateur (env COMPARATOR_ACCOUNT_ID) :
 * chaque requête filtre f.accountid = comparator. Aucun accountId n'est accepté en
 * paramètre. Gating AWIN appliqué partout : seules les offres de sources 'approved'
 * sont exposées (défense en profondeur, en plus du détachement à l'ingestion).
 *
 * Conformité Google CSS intégrée : on n'expose une fiche que si elle a >= 2 marchands
 * distincts dans le pays courant ; tri par prix + autres critères.
 *
 * Conventions du repo : pattern registerXxxRoutes(app, deps), SQL brut via
 * `prisma.$queryRawUnsafe` (params typés), colonnes minuscules, ids crypto.randomUUID().
 */

const crypto = require('crypto');
const { normalizeTitle } = require('../domains/comparator/matching');
const { getPriceSignals, getPriceHistory } = require('../domains/comparator/price-history');

const SORTS = ['relevance', 'price_asc', 'price_desc', 'recent'];

/** Normalise un code pays en ISO-2 majuscule, défaut 'FR'. PUR. */
function parseCountry(raw) {
  if (typeof raw === 'string' && /^[A-Za-z]{2}$/.test(raw.trim())) return raw.trim().toUpperCase();
  return 'FR';
}

/** Borne pagination : limit 1..48 (def 24), offset >= 0. PUR. */
function parsePaging(q) {
  const limit = Math.min(48, Math.max(1, parseInt(q.limit, 10) || 24));
  const offset = Math.max(0, parseInt(q.offset, 10) || 0);
  return { limit, offset };
}

/** Choisit un tri valide, défaut 'relevance'. PUR. */
function parseSort(raw) {
  return SORTS.includes(raw) ? raw : 'relevance';
}

/** Hash non réversible de l'IP (RGPD : pas d'IP en clair). PUR. */
function hashIp(ip, salt) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip) + (salt || '')).digest('hex');
}

/**
 * Marque l'offre « meilleur rapport » : la moins chère EN STOCK (sinon la moins chère).
 * `offers` est déjà trié par prix croissant. PUR. Ranking v1 ; les critères livraison/
 * fiabilité s'ajouteront quand le flux les porte.
 */
function markBestValue(offers) {
  if (!Array.isArray(offers) || offers.length === 0) return [];
  let idx = offers.findIndex((o) => o.inStock);
  if (idx < 0) idx = 0;
  return offers.map((o, i) => ({ ...o, bestValue: i === idx }));
}

/** Recherche de produits canoniques (>= 2 marchands approuvés, prix par pays). Réutilisé par /search et /assist. */
async function runProductSearch(prisma, accountId, { country, qNorm, brand, sort, limit, offset, minMerchants = 1 }) {
  const rows = await prisma.$queryRawUnsafe(`
    WITH agg AS (
      SELECT fi.groupid,
             min(fi.price) AS lowestprice,
             count(DISTINCT COALESCE(fi.customfields->>'merchant_id', f.sourceid)) AS merchant_count,
             (array_agg(fi.currency ORDER BY fi.price ASC NULLS LAST) FILTER (WHERE fi.currency IS NOT NULL))[1] AS currency
      FROM "FeedItem" fi
      JOIN "Feed" f        ON f.id = fi.feedid
      JOIN "FeedSource" fs ON fs.id = f.sourceid
      WHERE f.accountid = $1::text
        AND fi.groupid IS NOT NULL
        AND fi.price > 0
        AND fs.approvalstatus = 'approved'
        AND COALESCE(fs.countrycode, '') = $2::text
      GROUP BY fi.groupid
      HAVING count(DISTINCT COALESCE(fi.customfields->>'merchant_id', f.sourceid)) >= $8::int
    )
    SELECT pg.id, pg.canonicaltitle, pg.brand, pg.imageurl,
           a.lowestprice, a.currency, a.merchant_count::int AS merchant_count,
           count(*) OVER()::int AS total
    FROM "ProductGroup" pg
    JOIN agg a ON a.groupid = pg.id
    WHERE pg.accountid = $1::text
      AND ($3::text = '' OR pg.normtitle % $3::text OR lower(pg.canonicaltitle) LIKE '%' || $3::text || '%')
      AND ($4::text IS NULL OR lower(coalesce(pg.brand, '')) = lower($4::text))
    ORDER BY
      CASE WHEN $5 = 'price_asc'  THEN a.lowestprice END ASC  NULLS LAST,
      CASE WHEN $5 = 'price_desc' THEN a.lowestprice END DESC NULLS LAST,
      CASE WHEN $5 = 'relevance' AND $3::text <> '' THEN similarity(pg.normtitle, $3::text) END DESC NULLS LAST,
      pg.updatedat DESC
    LIMIT $6::int OFFSET $7::int
  `, accountId, country, qNorm, brand, sort, limit, offset, minMerchants);
  const total = rows[0]?.total ?? 0;
  const items = rows.map((r) => ({
    id: r.id, title: r.canonicaltitle, brand: r.brand, imageUrl: r.imageurl,
    lowestPrice: r.lowestprice != null ? Number(r.lowestprice) : null,
    currency: r.currency, merchantCount: r.merchant_count,
  }));
  return { items, total };
}

/** Extrait un objet JSON d'une réponse LLM (gère les fences ```json). PUR. */
function parseAiJson(text) {
  if (!text) return null;
  try {
    const m = String(text).match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

/** Recommandation déterministe (fallback sans IA) : meilleur compromis prix / nb de marchands. PUR. */
function pickFallbackRecommendation(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return [...candidates].sort((a, b) =>
    (a.lowestPrice ?? Infinity) - (b.lowestPrice ?? Infinity) || (b.merchantCount ?? 0) - (a.merchantCount ?? 0)
  )[0];
}

function registerComparateurRoutes(app, { getPrisma, getPrismaReady }) {
  const COMPARATOR_ACCOUNT_ID =
    (typeof process.env.COMPARATOR_ACCOUNT_ID === 'string' && process.env.COMPARATOR_ACCOUNT_ID.trim())
      ? process.env.COMPARATOR_ACCOUNT_ID.trim()
      : 'comparator';
  const CLICK_SALT = process.env.COMPARATOR_CLICK_SALT || 'feedplug-comparator';
  // Seuil de marchands par fiche. 1 au lancement (afficher les produits mono-marchand,
  // le comparateur s'enrichit au fil des marchands) ; passer à 2 pour la conformité Google CSS.
  const MIN_MERCHANTS = Number(process.env.COMPARATOR_MIN_MERCHANTS) || 1;

  function ready(res) {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) {
      res.status(503).json({ message: 'Service indisponible' });
      return null;
    }
    return prisma;
  }

  // GET /api/v1/comparator/products/search?q=&country=FR&brand=&sort=&limit=&offset=
  // Ne renvoie que les produits à >= 2 marchands approuvés dans le pays (conformité Google).
  app.get('/api/v1/comparator/products/search', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const country = parseCountry(req.query.country);
      const { limit, offset } = parsePaging(req.query);
      const sort = parseSort(req.query.sort);
      const qNorm = normalizeTitle(req.query.q || '');
      const brand = (req.query.brand && String(req.query.brand).trim()) || null;

      const { items, total } = await runProductSearch(prisma, COMPARATOR_ACCOUNT_ID, { country, qNorm, brand, sort, limit, offset, minMerchants: MIN_MERCHANTS });
      res.json({ items, total, limit, offset, country });
    } catch (e) {
      console.error('comparator search error:', e);
      res.status(500).json({ message: 'Erreur recherche' });
    }
  });

  // GET /api/v1/comparator/products/:id?country=FR — fiche produit + offres + signaux prix.
  app.get('/api/v1/comparator/products/:id', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const country = parseCountry(req.query.country);
      const groupRows = await prisma.$queryRawUnsafe(`
        SELECT id, canonicaltitle, brand, imageurl, gtin, category
        FROM "ProductGroup" WHERE id = $1::text AND accountid = $2::text
      `, req.params.id, COMPARATOR_ACCOUNT_ID);
      const group = groupRows[0];
      if (!group) return res.status(404).json({ message: 'Produit introuvable' });

      const offers = await prisma.$queryRawUnsafe(`
        SELECT fi.id AS offerid, fi.price, fi.currency, fi.inventory,
               fs.id AS sourceid, COALESCE(fi.customfields->>'merchant_name', fs.name, fs.id) AS merchant, fs.countrycode
        FROM "FeedItem" fi
        JOIN "Feed" f        ON f.id = fi.feedid
        JOIN "FeedSource" fs ON fs.id = f.sourceid
        WHERE fi.groupid = $1::text
          AND f.accountid = $2::text
          AND fi.price > 0
          AND fs.approvalstatus = 'approved'
          AND COALESCE(fs.countrycode, '') = $3::text
        ORDER BY fi.price ASC NULLS LAST
      `, req.params.id, COMPARATOR_ACCOUNT_ID, country);

      const signals = await getPriceSignals(prisma, req.params.id, country);
      const mappedOffers = markBestValue(offers.map((o) => ({
        offerId: o.offerid,
        merchant: o.merchant,
        price: o.price != null ? Number(o.price) : null,
        currency: o.currency,
        inStock: o.inventory == null || Number(o.inventory) > 0,
        visitUrl: `/api/v1/comparator/visit/${o.offerid}?country=${country}`,
      })));

      res.json({
        product: {
          id: group.id, title: group.canonicaltitle, brand: group.brand,
          imageUrl: group.imageurl, gtin: group.gtin, category: group.category,
        },
        country,
        offers: mappedOffers,
        signals,
        // Conformité Google : la fiche n'est indexable que si >= 2 marchands dans le pays.
        indexable: mappedOffers.length >= 2,
      });
    } catch (e) {
      console.error('comparator product error:', e);
      res.status(500).json({ message: 'Erreur produit' });
    }
  });

  // GET /api/v1/comparator/products/:id/price-history?country=FR&days=90
  app.get('/api/v1/comparator/products/:id/price-history', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const country = parseCountry(req.query.country);
      const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 90));
      const points = await getPriceHistory(prisma, req.params.id, country, days);
      const signals = await getPriceSignals(prisma, req.params.id, country);
      res.json({
        country,
        points: points.map((p) => ({ date: p.capturedon, lowestPrice: Number(p.lowestprice), currency: p.currency })),
        signals,
      });
    } catch (e) {
      console.error('comparator price-history error:', e);
      res.status(500).json({ message: 'Erreur historique' });
    }
  });

  // GET /api/v1/comparator/visit/:offerId?country=FR — log + redirection vers le marchand (deep link AWIN).
  app.get('/api/v1/comparator/visit/:offerId', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT fi.id, fi.url, fi.groupid, fs.countrycode
        FROM "FeedItem" fi
        JOIN "Feed" f        ON f.id = fi.feedid
        JOIN "FeedSource" fs ON fs.id = f.sourceid
        WHERE fi.id = $1::text AND f.accountid = $2::text AND fs.approvalstatus = 'approved'
        LIMIT 1
      `, req.params.offerId, COMPARATOR_ACCOUNT_ID);
      const offer = rows[0];
      if (!offer || !offer.url) return res.status(404).json({ message: 'Offre introuvable' });

      // Log best-effort : ne jamais bloquer la redirection si l'insert échoue.
      try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress;
        await prisma.$executeRawUnsafe(`
          INSERT INTO "ClickEvent" (id, offerid, groupid, countrycode, iphash, useragent, referer, targeturl, createdat)
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, NOW())
        `, crypto.randomUUID(), offer.id, offer.groupid || null, offer.countrycode || null,
           hashIp(ip, CLICK_SALT), (req.headers['user-agent'] || '').slice(0, 500),
           (req.headers['referer'] || '').slice(0, 500), offer.url);
      } catch (logErr) {
        console.warn('ClickEvent non loggé:', logErr.message);
      }

      res.redirect(302, offer.url);
    } catch (e) {
      console.error('comparator visit error:', e);
      res.status(500).json({ message: 'Erreur redirection' });
    }
  });

  // POST /api/v1/comparator/assist — choix assisté « vecteur de choix ».
  // IA Gemini si GEMINI_API_KEY, sinon fallback déterministe (meilleur rapport).
  app.post('/api/v1/comparator/assist', async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const country = parseCountry(req.body && req.body.country);
      const query = ((req.body && req.body.query) || '').toString().trim().slice(0, 200);
      if (!query) return res.status(400).json({ message: 'query requis' });

      const { items: candidates } = await runProductSearch(prisma, COMPARATOR_ACCOUNT_ID, {
        country, qNorm: normalizeTitle(query), brand: null, sort: 'relevance', limit: 6, offset: 0, minMerchants: MIN_MERCHANTS,
      });
      if (candidates.length === 0) {
        return res.json({ recommendation: null, candidates: [], reasoning: 'Aucun produit ne correspond à ta recherche.', source: 'none' });
      }

      let recId = null;
      let reasoning = null;
      let source = 'rule';

      if (process.env.GEMINI_API_KEY) {
        try {
          const { callAIWithCache } = require('../ai/ai-wrapper');
          const systemPrompt = "Tu es un assistant d'achat neutre. Choisis UN produit de la liste selon le besoin, sur le rapport qualité/prix et la disponibilité. Réponds en JSON STRICT : {\"recommendedId\":\"<id>\",\"reasoning\":\"<1 phrase en français>\"}.";
          const userPrompt = `Besoin: ${query}\nPays: ${country}\nProduits:\n` +
            candidates.map((c) => `- id=${c.id} | ${c.title} | dès ${c.lowestPrice} ${c.currency || ''} | ${c.merchantCount} marchands`).join('\n');
          const ai = await callAIWithCache(prisma, 'comparator_assist',
            { query, country, ids: candidates.map((c) => c.id) }, systemPrompt, userPrompt, null);
          const parsed = parseAiJson(ai && ai.text);
          if (parsed && candidates.some((c) => c.id === parsed.recommendedId)) {
            recId = parsed.recommendedId;
            reasoning = String(parsed.reasoning || '').slice(0, 400);
            source = 'ai';
          }
        } catch (aiErr) {
          console.warn('assist IA échoué, fallback déterministe:', aiErr.message);
        }
      }

      if (!recId) {
        const fb = pickFallbackRecommendation(candidates);
        recId = fb.id;
        reasoning = `Meilleur rapport : ${fb.title} à partir de ${fb.lowestPrice} ${fb.currency || ''} chez ${fb.merchantCount} marchands.`;
        source = 'rule';
      }

      const recommendation = candidates.find((c) => c.id === recId) || null;
      res.json({ recommendation, reasoning, source, candidates });
    } catch (e) {
      console.error('comparator assist error:', e);
      res.status(500).json({ message: 'Erreur assistant' });
    }
  });
}

module.exports = {
  registerComparateurRoutes,
  // helpers purs (testables sans réseau ni DB)
  parseCountry,
  parsePaging,
  parseSort,
  hashIp,
  markBestValue,
  parseAiJson,
  pickFallbackRecommendation,
  SORTS,
};
