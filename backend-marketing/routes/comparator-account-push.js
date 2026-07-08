'use strict';

/**
 * routes/comparator-account-push.js — Abonnements push du compte conso.
 *
 * Namespace /api/v1/comparator/account/push/* (cookie cmp_session via
 * requireComparatorAuth, sauf public-key qui est publique : le front en a
 * besoin AVANT l'opt-in). Accepte les deux shapes :
 *   - web  : { subscription: { endpoint, keys: { p256dh, auth } } }
 *   - natif: { native: { platform: 'ios'|'android', token } }
 * Logique dans domains/comparator-account/push.js ; ici uniquement le HTTP.
 */

const {
  getVapidConfig,
  isValidSubscription,
  isValidNativeToken,
  saveSubscription,
  saveNativeToken,
  removeSubscription,
  removeNativeToken,
  sendToUser,
} = require('../domains/comparator-account/push');

function registerComparatorAccountPushRoutes(app, { getPrisma, getPrismaReady, requireComparatorAuth }) {
  const ready = (res) => {
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) { res.status(503).json({ message: 'Service indisponible' }); return null; }
    return prisma;
  };

  // Clé publique VAPID (publique : nécessaire avant l'authentification de l'opt-in).
  app.get('/api/v1/comparator/account/push/public-key', (req, res) => {
    const vapid = getVapidConfig();
    if (!vapid) return res.status(503).json({ message: 'Push non configuré' });
    res.json({ publicKey: vapid.publicKey });
  });

  app.post('/api/v1/comparator/account/push/subscribe', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      if (isValidNativeToken(body.native)) {
        await saveNativeToken(prisma, req.comparatorUser.id, body.native);
        return res.json({ ok: true, platform: body.native.platform });
      }
      if (isValidSubscription(body.subscription)) {
        await saveSubscription(prisma, req.comparatorUser.id, body.subscription, req.headers['user-agent']);
        return res.json({ ok: true, platform: 'web' });
      }
      return res.status(400).json({ message: 'Abonnement invalide' });
    } catch (e) {
      console.error('[comparator-push] subscribe error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  app.post('/api/v1/comparator/account/push/unsubscribe', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const body = req.body || {};
      if (body.native && typeof body.native.token === 'string' && body.native.token.trim()) {
        await removeNativeToken(prisma, req.comparatorUser.id, body.native.token.trim());
        return res.json({ ok: true });
      }
      if (typeof body.endpoint === 'string' && body.endpoint.trim()) {
        await removeSubscription(prisma, req.comparatorUser.id, body.endpoint.trim());
        return res.json({ ok: true });
      }
      return res.status(400).json({ message: 'endpoint ou native.token requis' });
    } catch (e) {
      console.error('[comparator-push] unsubscribe error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });

  // Notification de test vers tous les appareils du user connecté.
  app.post('/api/v1/comparator/account/push/test', requireComparatorAuth, async (req, res) => {
    const prisma = ready(res); if (!prisma) return;
    try {
      const result = await sendToUser(prisma, req.comparatorUser.id, {
        title: 'Feedplug — notification de test',
        body: 'Les alertes de prix sont bien activées sur cet appareil.',
        url: '/compte/produits',
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[comparator-push] test error:', e.message);
      res.status(500).json({ message: 'Erreur' });
    }
  });
}

module.exports = { registerComparatorAccountPushRoutes };
