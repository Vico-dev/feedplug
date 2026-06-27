/**
 * Routes "marketing audits" résiduelles (4 routes /api/v1/marketing/audits/:shareToken/*) :
 * génération de l'URL OAuth GMC depuis un audit public (platforms/gmc/auth-url) et
 * connexion d'une source depuis un audit (connectors shopify / prestashop / file).
 *
 * NB : complémentaire de routes/marketing.js (early-access, audits CRUD, leads, etc.).
 * Module frère créé pour préserver EXACTEMENT la position d'enregistrement d'origine
 * (ces routes restaient inline à des positions distinctes du registre marketing) : on
 * les enregistre à leur emplacement source via registerMarketingAuditsConnectRoutes,
 * sans les fusionner dans routes/marketing.js (qui est enregistré bien plus tôt).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en tête :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();`. Tous les symboles
 * du scope de run() sont injectés via `deps`. AUCUN changement de comportement.
 */
function registerMarketingAuditsConnectRoutes(app, {
  getPrisma,
  getPrismaReady,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
  OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
  OAUTH_EPHEMERAL_PROVIDER_GMC,
  OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
  OAuth2Client,
  SHOPIFY_APPS,
  resolveShopifyApp,
  SHOPIFY_OAUTH_STATE_TTL_MS,
  crypto,
  decryptObjectSecrets,
  fetchMarketingAuditFileItems,
  fetchPrestashopProducts,
  normalizeShopifyShop,
  storeOAuthEphemeralState,
  stringifyEncryptedJson,
}) {
app.get('/api/v1/marketing/audits/:shareToken/platforms/gmc/auth-url', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const rows = await prisma.$queryRawUnsafe(`
      SELECT sharetoken, locale FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1
    `, shareToken);
    if (!rows?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }
    const scopes = [
      'https://www.googleapis.com/auth/content',
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    const stateId = crypto.randomUUID();
    await storeOAuthEphemeralState({
      id: stateId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
      payload: { auditShareToken: shareToken, locale: rows[0].locale || 'fr', mode: 'marketing_audit_gmc' },
      ttlMs: 10 * 60 * 1000,
    });
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: scopes,
      state: stateId,
    });
    res.json({ authUrl });
  } catch (error) {
    console.error('Marketing audit GMC auth-url error:', error);
    res.status(500).json({ message: 'Erreur generation URL GMC' });
  }
});

app.post('/api/v1/marketing/audits/:shareToken/connectors/shopify/connect', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    const { shop } = req.body || {};
    // Connexion depuis un audit public → app connecteur (marchand qui paiera via Stripe).
    const shopifyApp = resolveShopifyApp('connector');
    if (!SHOPIFY_APPS.connector) {
      return res.status(503).json({ message: 'Connecteur Shopify non configuré' });
    }
    if (!shopifyApp.apiKey || !shopifyApp.apiSecret) {
      return res.status(500).json({ message: 'Clés Shopify non configurées côté serveur' });
    }
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!shop) {
      return res.status(400).json({ message: 'Paramètre shop requis' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const audits = await prisma.$queryRawUnsafe(`SELECT sharetoken, locale FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, shareToken);
    if (!audits?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }
    const state = crypto.randomUUID();
    try {
      await storeOAuthEphemeralState({
        id: state,
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
        payload: {
          shop: normalizedShop,
          guest: true,
          appId: shopifyApp.appId,
          auditShareToken: shareToken,
          locale: audits[0].locale || 'fr',
        },
        ttlMs: SHOPIFY_OAUTH_STATE_TTL_MS,
      });
    } catch (error) {
      console.error('Shopify marketing audit state persistence error:', error);
      return res.status(503).json({ message: 'Connexion Shopify temporairement indisponible' });
    }
    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      shopifyApp.apiKey
    )}&scope=${encodeURIComponent(shopifyApp.scopes)}&redirect_uri=${encodeURIComponent(
      shopifyApp.callbackUrl
    )}&state=${encodeURIComponent(state)}&grant_options[]=`;
    res.json({ url: authUrl });
  } catch (err) {
    console.error('Shopify marketing audit connect error:', err);
    res.status(500).json({ message: 'Erreur lors de l init OAuth Shopify' });
  }
});

app.post('/api/v1/marketing/audits/:shareToken/connectors/prestashop/connect', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    const shopUrl = typeof req.body?.shopUrl === 'string' ? req.body.shopUrl.trim() : '';
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!shopUrl || !apiKey) {
      return res.status(400).json({ message: 'URL boutique et cle API PrestaShop requises' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const audits = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, shareToken);
    if (!audits?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }

    const normalizedShopUrl = /^https?:\/\//i.test(shopUrl) ? shopUrl.replace(/\/+$/, '') : `https://${shopUrl.replace(/\/+$/, '')}`;
    await fetchPrestashopProducts({ baseUrl: normalizedShopUrl, apiKey, limit: 20 });

    const audit = audits[0];
    const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
    input.prestashopConnection = {
      shopUrl: normalizedShopUrl,
      apiKey,
      connectedAt: new Date().toISOString(),
    };

    await prisma.$executeRawUnsafe(`
      UPDATE marketing_audits
      SET shopurl = COALESCE($1::text, shopurl),
          connectortype = 'PRESTASHOP',
          inputjson = $2::jsonb,
          status = 'source_connected',
          "updatedAt" = NOW()
      WHERE sharetoken = $3::text
    `, normalizedShopUrl, stringifyEncryptedJson(input), shareToken);

    return res.json({
      success: true,
      message: 'Source PrestaShop connectee',
    });
  } catch (error) {
    console.error('Prestashop marketing audit connect error:', error);
    return res.status(500).json({ message: error.message || 'Erreur lors de la connexion PrestaShop' });
  }
});

app.post('/api/v1/marketing/audits/:shareToken/connectors/file/connect', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const shareToken = String(req.params.shareToken || '').trim();
    const feedUrl = typeof req.body?.feedUrl === 'string' ? req.body.feedUrl.trim() : '';
    if (!shareToken) {
      return res.status(400).json({ message: 'Token audit manquant' });
    }
    if (!feedUrl) {
      return res.status(400).json({ message: 'URL de flux requise' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const audits = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, shareToken);
    if (!audits?.length) {
      return res.status(404).json({ message: 'Audit introuvable' });
    }

    const normalizedFeedUrl = /^https?:\/\//i.test(feedUrl) ? feedUrl.trim() : `https://${feedUrl.trim()}`;
    await fetchMarketingAuditFileItems({ ...audits[0], shopurl: normalizedFeedUrl }, { csvConnection: { feedUrl: normalizedFeedUrl } });

    const audit = audits[0];
    const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
    input.csvConnection = {
      feedUrl: normalizedFeedUrl,
      connectedAt: new Date().toISOString(),
    };

    await prisma.$executeRawUnsafe(`
      UPDATE marketing_audits
      SET shopurl = COALESCE($1::text, shopurl),
          connectortype = 'CSV',
          inputjson = $2::jsonb,
          status = 'source_connected',
          "updatedAt" = NOW()
      WHERE sharetoken = $3::text
    `, normalizedFeedUrl, stringifyEncryptedJson(input), shareToken);

    return res.json({
      success: true,
      message: 'Flux CSV/XML connecte',
    });
  } catch (error) {
    console.error('File marketing audit connect error:', error);
    return res.status(500).json({ message: error.message || 'Erreur lors de la connexion du flux' });
  }
});
}

module.exports = { registerMarketingAuditsConnectRoutes };
