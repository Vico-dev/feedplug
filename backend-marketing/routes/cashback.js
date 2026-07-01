'use strict';
// Endpoint interne de poll des conversions AWIN (déclenché par Cloud Scheduler).
// Auth : x-scheduler-secret (timing-safe), comme les autres scheduled-runs.
// Logique pure dans domains/cashback/* ; ici uniquement le HTTP.
const crypto = require('crypto');
const { fetchTransactions } = require('../domains/cashback/awin-client');
const { ingestTransactions } = require('../domains/cashback/ingest');

function timingSafeEq(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function isoSecond(d) { return new Date(d).toISOString().slice(0, 19); }

function registerCashbackRoutes(app, { getPrisma, getPrismaReady }) {
  // POST /api/v1/comparator/internal/cashback/poll
  app.post('/api/v1/comparator/internal/cashback/poll', async (req, res) => {
    const expected = (process.env.SCHEDULER_SECRET || '').trim();
    if (!expected || !timingSafeEq(req.headers['x-scheduler-secret'], expected)) {
      return res.status(401).json({ message: 'Non autorisé' });
    }
    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) return res.status(503).json({ message: 'Service indisponible' });

    const token = process.env.AWIN_API_TOKEN;
    const publisherId = process.env.COMPARATOR_PUBLISHER_ID;
    if (!token || !publisherId) {
      return res.status(503).json({ message: 'Cashback non configuré (AWIN_API_TOKEN / COMPARATOR_PUBLISHER_ID manquant)' });
    }
    const share = Number(process.env.COMPARATOR_CASHBACK_SHARE) || 0.5;
    const days = Math.min(Number(process.env.CASHBACK_POLL_DAYS) || 31, 31); // borne API AWIN

    try {
      const end = (req.body && req.body.endDate) ? isoSecond(req.body.endDate) : isoSecond(Date.now());
      const start = isoSecond(Date.now() - days * 24 * 3600 * 1000);
      const out = { window: { start, end } };
      // dateType=transaction (nouvelles ventes) + validation (passages pending→approved/declined).
      for (const dateType of ['transaction', 'validation']) {
        const tx = await fetchTransactions({ token, publisherId, startDate: start, endDate: end, dateType });
        out[dateType] = await ingestTransactions(prisma, tx, { share });
      }
      return res.json({ ok: true, ...out });
    } catch (e) {
      console.error('[cashback] poll error:', e.message);
      return res.status(502).json({ message: 'Erreur poll AWIN', detail: e.message });
    }
  });
}

module.exports = { registerCashbackRoutes, timingSafeEq, isoSecond };
