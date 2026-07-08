'use strict';

/**
 * routes/comparator-ai-enrich.js — Endpoint interne d'enrichissement IA du catalogue.
 *
 * POST /api/v1/comparator/internal/ai-enrich  { limit?, batchSize? }
 * Catégorise via Gemini les produits que les mots-clés n'ont pas su classer
 * (+ couleur manquante). Pensé pour le backfill (appels répétés bornés) et un
 * éventuel cron. Auth x-scheduler-secret via checkSchedulerAuth (fail-closed,
 * timing-safe — même mécanique que price-alerts). Logique dans
 * domains/comparator/ai-categorization.js ; no-op propre sans GEMINI_API_KEY.
 */

const { checkSchedulerAuth } = require('../lib/scheduler-auth');
const { runAiEnrichment } = require('../domains/comparator/ai-categorization');

function registerComparatorAiEnrichRoutes(app, { getPrisma, getPrismaReady }) {
  app.post('/api/v1/comparator/internal/ai-enrich', async (req, res) => {
    const auth = checkSchedulerAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

    const prisma = getPrisma();
    if (!getPrismaReady() || !prisma) return res.status(503).json({ message: 'Service indisponible' });

    try {
      const body = req.body || {};
      const result = await runAiEnrichment(prisma, {
        limit: body.limit,
        batchSize: body.batchSize,
      });
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[ai-enrich] run error:', e.message);
      return res.status(500).json({ message: 'Erreur enrichissement IA', detail: e.message });
    }
  });
}

module.exports = { registerComparatorAiEnrichRoutes };
