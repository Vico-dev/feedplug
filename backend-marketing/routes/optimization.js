/**
 * Routes du domaine "optimization" (1 route /api/v1/optimization/titles/generate) :
 * génération en lot de titres optimisés par IA (gate addonIA + quota texte).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handler copié À L'IDENTIQUE. Seul ajout en tête :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();`. Les helpers
 * (optimizeTitleWithAI, canUseFeature, checkAiQuota/quotaMessage, resolveItemId,
 * trackAiUsage, verifyItemAccess) restent définis/requis dans server-minimal.js et
 * sont injectés via `deps` (optimizeTitleWithAI/checkAiQuota sont aussi utilisés par
 * d'autres routes -> on n'y relocalise pas le require). AUCUN changement de comportement.
 */
function registerOptimizationRoutes(app, {
  getPrisma,
  getPrismaReady,
  authenticateToken,
  canUseFeature,
  checkAiQuota,
  optimizeTitleWithAI,
  quotaMessage,
  resolveItemId,
  trackAiUsage,
  verifyItemAccess,
}) {
app.post('/api/v1/optimization/titles/generate', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { itemIds, platform } = req.body || {};
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: 'itemIds requis (tableau non vide)' });
    }
    const MAX_ITEMS = 50;
    if (itemIds.length > MAX_ITEMS) {
      return res.status(400).json({ message: `Maximum ${MAX_ITEMS} produits par requête` });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.accountId;
    const addonIA = await canUseFeature(prisma, accountId, 'addonIA');
    if (!addonIA.allowed) {
      return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
    }
    // A3 — hard cap texte avant les appels Gemini (1 op = 1 titre / produit).
    const quota = await checkAiQuota(prisma, accountId, 'text', itemIds.length);
    if (!quota.allowed) {
      return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quota), used: quota.used, cap: quota.cap, remaining: quota.remaining, requested: itemIds.length });
    }
    const plat = platform ? String(platform).toUpperCase().replace(/GOOGLE/, 'GMC') : 'GMC';
    const result = {};
    let aiCalls = 0;
    for (const itemId of itemIds) {
      const itemIdStr = String(itemId);
      const resolvedId = await resolveItemId(prisma, itemIdStr, accountId) || itemIdStr;
      const verified = await verifyItemAccess(resolvedId, accountId);
      if (!verified) {
        result[itemIdStr] = '';
        continue;
      }
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "FeedItem" WHERE id = $1::text`, resolvedId);
      if (!rows || rows.length === 0) {
        result[itemIdStr] = '';
        continue;
      }
      const item = rows[0];
      let customFields = {};
      if (item.customfields) {
        try {
          customFields = typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields;
        } catch (e) {
          customFields = {};
        }
      }
      const product = { ...item, customFields };
      try {
        aiCalls++;
        const opt = await optimizeTitleWithAI(prisma, product, { platform: plat, forceRefresh: false });
        result[itemIdStr] = opt.optimizedTitle || item.title || '';
      } catch (err) {
        console.warn('Erreur optimisation titre pour', itemIdStr, err.message);
        result[itemIdStr] = item.title || '';
      }
    }
    // B1 — comptage de la consommation IA (1 op = 1 titre généré).
    if (aiCalls > 0) trackAiUsage(accountId, aiCalls);
    const hasAny = Object.values(result).some((v) => v && String(v).trim());
    if (!hasAny && itemIds.length > 0) {
      result._error = 'Aucun titre optimisé généré. Vérifiez que l\'IA est configurée (clé Gemini) ou réessayez.';
    }
    res.json(result);
  } catch (error) {
    console.error('Erreur optimization/titles/generate:', error);
    res.status(500).json({ message: error.message || 'Erreur génération titres' });
  }
});
}

module.exports = { registerOptimizationRoutes };
