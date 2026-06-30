'use strict';

/**
 * routes/comparator-account-data.js — Données du COMPTE conso du comparateur.
 *
 * Namespace /api/v1/comparator/account/* (cookie cmp_session, distinct du B2B).
 * Surface : intérêts (catégories suivies), watchlist (« Mes produits »), feed perso baisses.
 * Toute la logique vit dans domains/comparator-account/{interests,watchlist,feed}.js ;
 * ici uniquement le HTTP. Une seule ligne d'enregistrement dans server-minimal.js.
 *
 * Réutilise le middleware requireComparatorAuth fabriqué par routes/comparator-account.js
 * (cookie -> req.comparatorUser.id). Gating AWIN ('approved'/opt-in) appliqué dans le SQL
 * des domaines, identique à routes/comparateur.js.
 */

const { getInterests, setInterests } = require('../domains/comparator-account/interests');
const {
  normCountry,
  groupExists,
  addWatch,
  removeWatch,
  listWatchlist,
} = require('../domains/comparator-account/watchlist');
const { getPersonalFeed, parsePaging } = require('../domains/comparator-account/feed');
const {
  getDemographics,
  setDemographics,
  getFavoriteBrands,
  setFavoriteBrands,
  getRecommendations,
} = require('../domains/comparator-account/personalization');

function registerComparatorAccountDataRoutes(app, { getPrisma, getPrismaReady, requireComparatorAuth }) {
  const COMPARATOR_ACCOUNT_ID =
    (typeof process.env.COMPARATOR_ACCOUNT_ID === 'string' && process.env.COMPARATOR_ACCOUNT_ID.trim())
      ? process.env.COMPARATOR_ACCOUNT_ID.trim()
      : 'comparator';

  const ready = (res) => {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) { res.status(503).json({ message: 'Service indisponible' }); return null; }
    return prisma;
  };

  // ───────── Intérêts (catégories suivies) ─────────

  app.get('/api/v1/comparator/account/interests', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const categoryIds = await getInterests(prisma, req.comparatorUser.id);
      res.json({ categoryIds });
    } catch (e) {
      console.error('[comparator-account-data] interests get error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // Set COMPLET : remplace toutes les catégories suivies par { categoryIds: [...] }.
  app.put('/api/v1/comparator/account/interests', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      const saved = await setInterests(prisma, req.comparatorUser.id, body.categoryIds);
      res.json({ categoryIds: saved });
    } catch (e) {
      console.error('[comparator-account-data] interests put error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── Watchlist (« Mes produits ») ─────────

  app.get('/api/v1/comparator/account/watchlist', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const items = await listWatchlist(prisma, COMPARATOR_ACCOUNT_ID, req.comparatorUser.id);
      res.json({ items });
    } catch (e) {
      console.error('[comparator-account-data] watchlist get error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // Suivre un produit : { groupId, country }. Capture le prix courant (priceatadd).
  app.post('/api/v1/comparator/account/watchlist', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : '';
      if (!groupId) return res.status(400).json({ message: 'groupId requis' });
      const country = normCountry(body.country);
      const exists = await groupExists(prisma, COMPARATOR_ACCOUNT_ID, groupId);
      if (!exists) return res.status(404).json({ message: 'Produit introuvable' });
      const { created } = await addWatch(prisma, COMPARATOR_ACCOUNT_ID, req.comparatorUser.id, { groupId, country });
      res.status(created ? 201 : 200).json({ ok: true, created, groupId, country });
    } catch (e) {
      console.error('[comparator-account-data] watchlist post error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // Ne plus suivre : DELETE /:groupId (?country=FR pour ne retirer qu'un pays).
  app.delete('/api/v1/comparator/account/watchlist/:groupId', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const groupId = (req.params.groupId || '').trim();
      if (!groupId) return res.status(400).json({ message: 'groupId requis' });
      const country = req.query.country ? normCountry(req.query.country) : null;
      await removeWatch(prisma, req.comparatorUser.id, { groupId, country });
      res.json({ ok: true });
    } catch (e) {
      console.error('[comparator-account-data] watchlist delete error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── Feed perso (baisses des catégories suivies) ─────────

  app.get('/api/v1/comparator/account/feed', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const country = normCountry(req.query.country);
      const { limit, offset } = parsePaging(req.query.limit, req.query.offset);
      // Pondération par affinité marques (perso). Non bloquant : [] si l'user n'en a pas.
      const favoriteBrands = await getFavoriteBrands(prisma, req.comparatorUser.id);
      const { items, total } = await getPersonalFeed(prisma, COMPARATOR_ACCOUNT_ID, req.comparatorUser.id, { country, limit, offset, favoriteBrands });
      res.json({ items, total, limit, offset, country });
    } catch (e) {
      console.error('[comparator-account-data] feed error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── Profil socio-démo (RGPD : optionnel + consenti) ─────────

  app.get('/api/v1/comparator/account/profile-demographics', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const demographics = await getDemographics(prisma, req.comparatorUser.id);
      res.json({ demographics });
    } catch (e) {
      console.error('[comparator-account-data] demographics get error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // Upsert socio-démo. `consent` (booléen) requis pour poser le consentement ; sinon stocké sans
  // consentat (et la perso retombe sur les seuls intérêts). Valeurs hors-liste blanche → null.
  app.put('/api/v1/comparator/account/profile-demographics', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const demographics = await setDemographics(prisma, req.comparatorUser.id, req.body || {});
      res.json({ demographics });
    } catch (e) {
      console.error('[comparator-account-data] demographics put error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── Affinité marques (set complet remplaçable) ─────────

  app.get('/api/v1/comparator/account/brands', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const brands = await getFavoriteBrands(prisma, req.comparatorUser.id);
      res.json({ brands });
    } catch (e) {
      console.error('[comparator-account-data] brands get error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  app.put('/api/v1/comparator/account/brands', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      const brands = await setFavoriteBrands(prisma, req.comparatorUser.id, body.brands);
      res.json({ brands });
    } catch (e) {
      console.error('[comparator-account-data] brands put error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── « Recommandé pour toi » (perso : intérêts + affinité marques) ─────────

  app.get('/api/v1/comparator/account/recommendations', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const country = normCountry(req.query.country);
      const limit = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 8));
      const { items } = await getRecommendations(prisma, COMPARATOR_ACCOUNT_ID, req.comparatorUser.id, { country, limit });
      res.json({ items, country });
    } catch (e) {
      console.error('[comparator-account-data] recommendations error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });
}

module.exports = { registerComparatorAccountDataRoutes };
