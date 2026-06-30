'use strict';

/**
 * routes/comparator-account-profile.js — Profil du COMPTE conso du comparateur.
 *
 * Namespace /api/v1/comparator/account/* (cookie cmp_session, distinct du B2B).
 * Surface :
 *   - GET    /api/v1/comparator/account/profile   → lire le profil
 *   - PUT    /api/v1/comparator/account/profile   → éditer (prénom, nom, pays, opt-in marketing)
 *   - DELETE /api/v1/comparator/account            → suppression RGPD (status='deleted' + purge)
 *
 * Toute la logique vit dans domains/comparator-account/profile.js ; ici uniquement le HTTP.
 * Une SEULE ligne d'enregistrement dans server-minimal.js. Réutilise le middleware
 * requireComparatorAuth fabriqué par routes/comparator-account.js (cookie -> req.comparatorUser.id).
 *
 * ⚠️ Périmètre strict : identité (prénom/nom), pays préféré, opt-in marketing, suppression.
 * Ne touche PAS l'onboarding, les intérêts, la socio-démo/affinité.
 */

const { getProfile, updateProfile, deleteAccount } = require('../domains/comparator-account/profile');
const { COOKIE } = require('./comparator-account');

function registerComparatorAccountProfileRoutes(app, { getPrisma, getPrismaReady, requireComparatorAuth }) {
  const ready = (res) => {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) { res.status(503).json({ message: 'Service indisponible' }); return null; }
    return prisma;
  };

  // ───────── Lire le profil ─────────
  app.get('/api/v1/comparator/account/profile', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const profile = await getProfile(prisma, req.comparatorUser.id);
      if (!profile) return res.status(404).json({ message: 'Introuvable' });
      return res.json(profile);
    } catch (e) {
      console.error('[comparator-account-profile] get error:', e.message);
      return res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── Éditer le profil (PATCH partiel : seuls les champs fournis sont modifiés) ─────────
  app.put('/api/v1/comparator/account/profile', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const profile = await updateProfile(prisma, req.comparatorUser.id, req.body || {});
      if (!profile) return res.status(404).json({ message: 'Introuvable' });
      return res.json(profile);
    } catch (e) {
      console.error('[comparator-account-profile] update error:', e.message);
      return res.status(500).json({ message: 'Erreur' });
    }
  });

  // ───────── Suppression RGPD du compte ─────────
  app.delete('/api/v1/comparator/account', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      await deleteAccount(prisma, req.comparatorUser.id);
      // La session vient d'être purgée côté DB ; on efface le cookie pour cohérence client.
      res.clearCookie(COOKIE, { path: '/' });
      return res.status(200).json({ message: 'Compte supprimé' });
    } catch (e) {
      console.error('[comparator-account-profile] delete error:', e.message);
      return res.status(500).json({ message: 'Erreur' });
    }
  });
}

module.exports = { registerComparatorAccountProfileRoutes };
