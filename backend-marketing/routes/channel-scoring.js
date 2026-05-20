/**
 * Routes API pour la configuration du scoring par canal (qualité + performance).
 * Voir backend-marketing/docs/SCORING_QUALITE_ET_PERF_CANAL.md
 */

const CHANNELS = [
  { key: 'GOOGLE_ADS', name: 'Google Ads' },
  { key: 'META_ADS', name: 'Meta Ads' },
  { key: 'AMAZON', name: 'Amazon' },
  { key: 'MIRAKL', name: 'Mirakl' },
  { key: 'SHOPIFY', name: 'Shopify' },
  { key: 'OTHER', name: 'Autre' },
];

function registerChannelScoringRoutes(app, deps) {
  // Getter (et non valeur capturée) : `prisma` est initialisé après l'appel
  // à registerChannelScoringRoutes(). Capturer la valeur ici donnait `undefined`.
  const { getPrisma, authenticateToken, getAccountId } = deps;
  const accountId = (req) => (getAccountId ? getAccountId(req) : req.accountId) || 'default-account';

  /** Liste des canaux disponibles + configs du compte */
  app.get('/api/v1/scoring-canaux', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ message: 'Service non disponible' });
      const acct = accountId(req);
      const configs = await prisma.channelScoringConfig.findMany({
        where: { accountId: acct },
        orderBy: { channel: 'asc' },
      });
      const byChannel = Object.fromEntries(configs.map((c) => [c.channel, c]));
      const list = CHANNELS.map((ch) => {
        const config = byChannel[ch.key];
        return {
          channel: ch.key,
          name: ch.name,
          config: config
            ? {
                id: config.id,
                enabled: config.enabled,
                qualityWeight: Number(config.qualityWeight),
                performanceWeight: Number(config.performanceWeight),
                performanceMetrics: config.performanceMetrics,
                period: config.period,
                updatedAt: config.updatedAt,
              }
            : null,
        };
      });
      res.json({ channels: list });
    } catch (e) {
      console.error('scoring-canaux list:', e);
      res.status(500).json({ message: e.message });
    }
  });

  /** Détail d'une config pour un canal */
  app.get('/api/v1/scoring-canaux/:channel', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ message: 'Service non disponible' });
      const acct = accountId(req);
      const channel = (req.params.channel || '').toUpperCase();
      if (!CHANNELS.some((c) => c.key === channel)) {
        return res.status(400).json({ message: 'Canal invalide' });
      }
      const config = await prisma.channelScoringConfig.findUnique({
        where: {
          accountId_channel: { accountId: acct, channel },
        },
      });
      const meta = CHANNELS.find((c) => c.key === channel);
      if (!config) {
        return res.json({
          channel,
          name: meta?.name ?? channel,
          config: null,
        });
      }
      res.json({
        channel: config.channel,
        name: config.name,
        config: {
          id: config.id,
          enabled: config.enabled,
          qualityWeight: Number(config.qualityWeight),
          performanceWeight: Number(config.performanceWeight),
          performanceMetrics: config.performanceMetrics,
          period: config.period,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      });
    } catch (e) {
      console.error('scoring-canaux get:', e);
      res.status(500).json({ message: e.message });
    }
  });

  /** Créer ou mettre à jour la config pour un canal */
  app.put('/api/v1/scoring-canaux/:channel', authenticateToken, async (req, res) => {
    try {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ message: 'Service non disponible' });
      const acct = accountId(req);
      const channel = (req.params.channel || '').toUpperCase();
      if (!CHANNELS.some((c) => c.key === channel)) {
        return res.status(400).json({ message: 'Canal invalide' });
      }
      const meta = CHANNELS.find((c) => c.key === channel);
      const body = req.body || {};
      let qualityWeight = typeof body.qualityWeight === 'number' ? body.qualityWeight : 0.5;
      let performanceWeight = typeof body.performanceWeight === 'number' ? body.performanceWeight : 0.5;
      const sum = qualityWeight + performanceWeight;
      if (sum > 0) {
        qualityWeight = Math.round((qualityWeight / sum) * 100) / 100;
        performanceWeight = Math.round((performanceWeight / sum) * 100) / 100;
      }
      const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : (meta?.name ?? channel);
      const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
      const performanceMetrics = body.performanceMetrics && typeof body.performanceMetrics === 'object' ? body.performanceMetrics : {};
      const period = typeof body.period === 'string' && body.period.trim() ? body.period.trim() : 'LAST_30_DAYS';

      const config = await prisma.channelScoringConfig.upsert({
        where: {
          accountId_channel: { accountId: acct, channel },
        },
        create: {
          accountId: acct,
          channel,
          name,
          enabled,
          qualityWeight,
          performanceWeight,
          performanceMetrics,
          period,
        },
        update: {
          name,
          enabled,
          qualityWeight,
          performanceWeight,
          performanceMetrics,
          period,
        },
      });

      res.json({
        channel: config.channel,
        name: config.name,
        config: {
          id: config.id,
          enabled: config.enabled,
          qualityWeight: Number(config.qualityWeight),
          performanceWeight: Number(config.performanceWeight),
          performanceMetrics: config.performanceMetrics,
          period: config.period,
          updatedAt: config.updatedAt,
        },
      });
    } catch (e) {
      console.error('scoring-canaux put:', e);
      res.status(500).json({ message: e.message });
    }
  });
}

module.exports = { registerChannelScoringRoutes, CHANNELS };
