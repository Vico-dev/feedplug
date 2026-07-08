'use strict';

/**
 * routes/comparator-alerts.js — Endpoint interne du cron d'alertes baisse de prix.
 *
 * POST /api/v1/comparator/internal/price-alerts, déclenché par Cloud Scheduler
 * (job feedplug-comparator-price-alerts, 08:00 Europe/Paris), auth x-scheduler-secret
 * via checkSchedulerAuth (fail-closed, timing-safe — même mécanique que les autres
 * scheduled-runs). Logique dans domains/comparator-account/price-alerts.js ;
 * envois via push.sendToUser + sendComparatorPriceDropEmail.
 */

const { checkSchedulerAuth } = require('../lib/scheduler-auth');
const { runPriceAlerts } = require('../domains/comparator-account/price-alerts');
const { sendToUser } = require('../domains/comparator-account/push');
const { sendComparatorPriceDropEmail } = require('../email/email-service');

function registerComparatorAlertsRoutes(app, { getPrisma, getPrismaReady }) {
  const COMPARATOR_ACCOUNT_ID =
    (typeof process.env.COMPARATOR_ACCOUNT_ID === 'string' && process.env.COMPARATOR_ACCOUNT_ID.trim())
      ? process.env.COMPARATOR_ACCOUNT_ID.trim()
      : 'comparator';

  app.post('/api/v1/comparator/internal/price-alerts', async (req, res) => {
    const auth = checkSchedulerAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) return res.status(503).json({ message: 'Service indisponible' });

    try {
      const result = await runPriceAlerts(prisma, COMPARATOR_ACCOUNT_ID, {
        sendPush: (userId, payload) => sendToUser(prisma, userId, payload),
        sendEmail: (email, items) => sendComparatorPriceDropEmail(email, items),
      });
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[price-alerts] run error:', e.message);
      return res.status(500).json({ message: 'Erreur alertes prix', detail: e.message });
    }
  });
}

module.exports = { registerComparatorAlertsRoutes };
