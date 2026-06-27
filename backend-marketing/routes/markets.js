/**
 * Routes du domaine "markets" (10 routes /api/v1/markets/...) : liste/création des
 * marchés, lecture/mise à jour d'un marché, gestion des locales et des canaux
 * (publication par marché), readiness et prévisualisation traduite d'un produit.
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en
 * tête de chaque handler utilisant Prisma :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();` pour
 * résoudre la valeur vivante du client Prisma (réassigné pendant l'init de
 * run()) sans réécrire les références. Toutes les dépendances du scope de run()
 * (helpers marchés, normalisation, hydratation, sync destinations, etc.) sont
 * injectées via `deps`. Leurs définitions RESTENT dans server-minimal.js.
 * AUCUN changement de comportement.
 */
const { translateProductForMarket } = require('../optimization/market-translation');

function registerMarketsRoutes(app, {
  getPrisma,
  getPrismaReady,
  MARKET_PLATFORM_OPTIONS,
  authenticateToken,
  canManageMarkets,
  checkChannelLimit,
  countChannelsForAccount,
  createMarket,
  crypto,
  ensureMarketLocales,
  ensureMarketsBackfillForAccount,
  getHydratedMarketsForAccount,
  getMarketCurrency,
  getMarketName,
  getMarketsUnavailableResponse,
  inferAmazonChannelKeyForMarket,
  listPlatformAccountsForAccount,
  normalizeMarketChannelInput,
  normalizeMarketCode,
  normalizeMarketLocaleInput,
  normalizePlatformKey,
  parseJsonObject,
  pickPlatformAccountId,
  syncDestinationsForMarket,
  upsertMarketChannels,
}) {
app.get('/api/v1/markets', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ markets });
  } catch (error) {
    console.error('GET /markets error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors du chargement des marchés' });
  }
});

app.post('/api/v1/markets', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour créer un marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);

    const body = req.body || {};
    const code = normalizeMarketCode(body.code || body.marketCode || body.targetMarketCode || '');
    if (!code) {
      return res.status(400).json({ message: 'Le code marché est requis (ex. IT, BE, CH).' });
    }

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Market" WHERE accountid = $1::text AND code = $2::text LIMIT 1`,
      accountId,
      code
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: `Le marché ${code} existe déjà sur ce compte.` });
    }

    const existingMarkets = await getHydratedMarketsForAccount(accountId);
    const sourceMarketId = body.sourceMarketId || null;
    const sourceMarket = sourceMarketId
      ? existingMarkets.find((market) => market.id === sourceMarketId)
      : null;
    if (sourceMarketId && !sourceMarket) {
      return res.status(404).json({ message: 'Marché source introuvable sur ce compte.' });
    }

    const name = String(body.name || '').trim() || getMarketName(code);
    const countryCodes = Array.isArray(body.countryCodes) && body.countryCodes.length > 0
      ? body.countryCodes.map((entry) => normalizeMarketCode(entry)).filter(Boolean)
      : [code];
    const defaultCurrencyCode = String(body.defaultCurrencyCode || sourceMarket?.defaultCurrencyCode || getMarketCurrency(code)).trim().toUpperCase();
    const marketId = await createMarket(accountId, {
      code,
      name,
      sourceMarketId,
      countryCodes,
      defaultCurrencyCode,
      status: String(body.status || 'draft').trim() || 'draft',
      pricingPolicyJson: body.pricingPolicy || body.pricingPolicyJson || sourceMarket?.pricingPolicy || {},
      shippingPolicyJson: body.shippingPolicy || body.shippingPolicyJson || sourceMarket?.shippingPolicy || {},
      taxPolicyJson: body.taxPolicy || body.taxPolicyJson || sourceMarket?.taxPolicy || {},
      contentStrategyJson: body.contentStrategy || body.contentStrategyJson || sourceMarket?.contentStrategy || {},
      publicationDefaultsJson: body.publicationDefaults || body.publicationDefaultsJson || sourceMarket?.publicationDefaults || {},
    });

    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    const localesInput = Array.isArray(body.locales) && body.locales.length > 0
      ? body.locales
      : (sourceMarket?.locales || []);
    await ensureMarketLocales(marketId, code, localesInput);

    const platformAccounts = await listPlatformAccountsForAccount(accountId);
    const channelsInput = Array.isArray(body.channels) && body.channels.length > 0
      ? body.channels
      : (sourceMarket?.channels || []).map((channel) => ({
        platformKey: channel.platformKey,
        platformAccountId: channel.platformAccountId,
        status: channel.status,
        isEnabled: channel.isEnabled,
        settingsJson: channel.settings,
      }));
    if (channelsInput.length > 0) {
      await upsertMarketChannels(marketRow, channelsInput, platformAccounts);
    }
    await syncDestinationsForMarket(accountId, marketId);

    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    res.status(201).json({ market });
  } catch (error) {
    console.error('POST /markets error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la création du marché' });
  }
});

app.get('/api/v1/markets/:marketId', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === req.params.marketId);
    if (!market) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }
    res.json({ market });
  } catch (error) {
    console.error('GET /markets/:marketId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors du chargement du marché' });
  }
});

app.patch('/api/v1/markets/:marketId', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier ce marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const body = req.body || {};
    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    if (!marketRow) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }

    const updates = [];
    const params = [];
    let index = 1;
    const pushText = (column, value) => {
      updates.push(`${column} = $${index++}::text`);
      params.push(value);
    };
    const pushJson = (column, value) => {
      updates.push(`${column} = $${index++}::jsonb`);
      params.push(JSON.stringify(value || {}));
    };

    if (body.code !== undefined) {
      const nextCode = normalizeMarketCode(body.code);
      if (!nextCode) return res.status(400).json({ message: 'Code marché invalide.' });
      const duplicate = await prisma.$queryRawUnsafe(
        `SELECT id FROM "Market" WHERE accountid = $1::text AND code = $2::text AND id != $3::text LIMIT 1`,
        accountId,
        nextCode,
        marketId
      );
      if (duplicate && duplicate.length > 0) {
        return res.status(409).json({ message: `Le marché ${nextCode} existe déjà sur ce compte.` });
      }
      pushText('code', nextCode);
    }
    if (body.name !== undefined) pushText('name', String(body.name || '').trim() || marketRow.name);
    if (body.defaultCurrencyCode !== undefined) pushText('defaultcurrencycode', String(body.defaultCurrencyCode || '').trim().toUpperCase() || marketRow.defaultcurrencycode);
    if (body.status !== undefined) pushText('status', String(body.status || '').trim() || marketRow.status);
    if (body.countryCodes !== undefined) pushJson('countrycodesjson', Array.isArray(body.countryCodes) ? body.countryCodes.map((entry) => normalizeMarketCode(entry)).filter(Boolean) : [marketRow.code]);
    if (body.pricingPolicy !== undefined || body.pricingPolicyJson !== undefined) pushJson('pricingpolicyjson', body.pricingPolicy || body.pricingPolicyJson || {});
    if (body.shippingPolicy !== undefined || body.shippingPolicyJson !== undefined) pushJson('shippingpolicyjson', body.shippingPolicy || body.shippingPolicyJson || {});
    if (body.taxPolicy !== undefined || body.taxPolicyJson !== undefined) pushJson('taxpolicyjson', body.taxPolicy || body.taxPolicyJson || {});
    if (body.contentStrategy !== undefined || body.contentStrategyJson !== undefined) pushJson('contentstrategyjson', body.contentStrategy || body.contentStrategyJson || {});
    if (body.publicationDefaults !== undefined || body.publicationDefaultsJson !== undefined) pushJson('publicationdefaultsjson', body.publicationDefaults || body.publicationDefaultsJson || {});

    if (updates.length === 0) {
      const markets = await getHydratedMarketsForAccount(accountId);
      return res.json({ market: markets.find((entry) => entry.id === marketId) || null });
    }

    updates.push('updatedat = NOW()');
    params.push(marketId);
    await prisma.$executeRawUnsafe(
      `UPDATE "Market" SET ${updates.join(', ')} WHERE id = $${index}::text`,
      ...params
    );
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ market: markets.find((entry) => entry.id === marketId) || null });
  } catch (error) {
    console.error('PATCH /markets/:marketId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la mise à jour du marché' });
  }
});

app.post('/api/v1/markets/:marketId/locales', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier les langues du marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    if (!marketRow) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }

    const currentLocales = await prisma.$queryRawUnsafe(
      `SELECT * FROM "MarketLocale" WHERE marketid = $1::text ORDER BY isdefault DESC, localecode ASC`,
      marketId
    );
    const localeInput = normalizeMarketLocaleInput(req.body || {}, marketRow.code, currentLocales.length);
    if (!localeInput.localeCode) {
      return res.status(400).json({ message: 'localeCode requis (ex. it-IT, fr-BE).' });
    }
    const existing = (currentLocales || []).find((locale) => String(locale.localecode).toLowerCase() === localeInput.localeCode.toLowerCase());
    if (localeInput.isDefault) {
      await prisma.$executeRawUnsafe(
        `UPDATE "MarketLocale" SET isdefault = false, updatedat = NOW() WHERE marketid = $1::text`,
        marketId
      );
    }
    if (existing) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "MarketLocale"
          SET languagecode = $1::text,
              countrycode = $2::text,
              isdefault = $3::boolean,
              isrequiredlaunch = $4::boolean,
              translationmode = $5::text,
              updatedat = NOW()
          WHERE id = $6::text
        `,
        localeInput.languageCode,
        localeInput.countryCode,
        localeInput.isDefault,
        localeInput.isRequiredLaunch,
        localeInput.translationMode,
        existing.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO "MarketLocale" (
            id, marketid, localecode, languagecode, countrycode, isdefault,
            isrequiredlaunch, translationmode, createdat, updatedat
          )
          VALUES (
            $1::text, $2::text, $3::text, $4::text, $5::text, $6::boolean,
            $7::boolean, $8::text, NOW(), NOW()
          )
        `,
        crypto.randomUUID(),
        marketId,
        localeInput.localeCode,
        localeInput.languageCode,
        localeInput.countryCode,
        localeInput.isDefault,
        localeInput.isRequiredLaunch,
        localeInput.translationMode
      );
    }
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    res.status(existing ? 200 : 201).json({ market, localeCode: localeInput.localeCode });
  } catch (error) {
    console.error('POST /markets/:marketId/locales error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de l’ajout de la langue du marché' });
  }
});

app.patch('/api/v1/markets/:marketId/locales/:localeId', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier cette langue' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId, localeId } = req.params;
    const localeRows = await prisma.$queryRawUnsafe(
      `
        SELECT ml.*, m.code AS marketcode
        FROM "MarketLocale" ml
        JOIN "Market" m ON m.id = ml.marketid
        WHERE ml.id = $1::text AND ml.marketid = $2::text AND m.accountid = $3::text
        LIMIT 1
      `,
      localeId,
      marketId,
      accountId
    );
    const localeRow = localeRows?.[0];
    if (!localeRow) {
      return res.status(404).json({ message: 'Langue de marché introuvable' });
    }

    const mergedInput = normalizeMarketLocaleInput(
      {
        localeCode: req.body?.localeCode || localeRow.localecode,
        languageCode: req.body?.languageCode || localeRow.languagecode,
        countryCode: req.body?.countryCode || localeRow.countrycode,
        isDefault: req.body?.isDefault === true,
        isRequiredLaunch: req.body?.isRequiredLaunch ?? localeRow.isrequiredlaunch,
        translationMode: req.body?.translationMode || localeRow.translationmode,
      },
      localeRow.marketcode,
      0
    );
    if (mergedInput.isDefault) {
      await prisma.$executeRawUnsafe(
        `UPDATE "MarketLocale" SET isdefault = false, updatedat = NOW() WHERE marketid = $1::text`,
        marketId
      );
    }
    await prisma.$executeRawUnsafe(
      `
        UPDATE "MarketLocale"
        SET localecode = $1::text,
            languagecode = $2::text,
            countrycode = $3::text,
            isdefault = $4::boolean,
            isrequiredlaunch = $5::boolean,
            translationmode = $6::text,
            updatedat = NOW()
        WHERE id = $7::text
      `,
      mergedInput.localeCode,
      mergedInput.languageCode,
      mergedInput.countryCode,
      mergedInput.isDefault,
      mergedInput.isRequiredLaunch,
      mergedInput.translationMode,
      localeId
    );
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ market: markets.find((entry) => entry.id === marketId) || null });
  } catch (error) {
    console.error('PATCH /markets/:marketId/locales/:localeId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la langue du marché' });
  }
});

app.post('/api/v1/markets/:marketId/channels', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier les canaux du marché' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const marketRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Market" WHERE id = $1::text AND accountid = $2::text LIMIT 1`,
      marketId,
      accountId
    );
    const marketRow = marketRows?.[0];
    if (!marketRow) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }

    const candidate = normalizeMarketChannelInput(req.body || {}, marketRow.code);
    if (!candidate.platformKey || !MARKET_PLATFORM_OPTIONS.includes(candidate.platformKey)) {
      return res.status(400).json({ message: 'platformKey invalide pour ce marché.' });
    }

    // Quota canaux : un nouveau canal de marché compte dans max_channels au
    // même titre qu'un canal d'export (compteur unifié).
    const existingChannelRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "MarketChannel" WHERE marketid = $1::text AND platformkey = $2::text LIMIT 1`,
      marketId,
      candidate.platformKey
    );
    const isNewChannel = !existingChannelRows?.[0];
    if (isNewChannel) {
      const currentChannels = await countChannelsForAccount(prisma, accountId);
      const channelLimit = await checkChannelLimit(prisma, accountId, currentChannels);
      if (!channelLimit.allowed) {
        return res.status(403).json({ code: 'PLAN_LIMIT', message: channelLimit.message });
      }
    }

    const platformAccounts = await listPlatformAccountsForAccount(accountId);
    await upsertMarketChannels(marketRow, [candidate], platformAccounts);
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    const channel = market?.channels?.find((entry) => entry.platformKey === candidate.platformKey) || null;
    res.status(201).json({ market, channel });
  } catch (error) {
    console.error('POST /markets/:marketId/channels error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de l’ajout du canal du marché' });
  }
});

app.patch('/api/v1/markets/:marketId/channels/:channelId', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!canManageMarkets(req)) {
      return res.status(403).json({ message: 'Permissions insuffisantes pour modifier ce canal' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId, channelId } = req.params;
    const channelRows = await prisma.$queryRawUnsafe(
      `
        SELECT mc.*, m.code AS marketcode
        FROM "MarketChannel" mc
        JOIN "Market" m ON m.id = mc.marketid
        WHERE mc.id = $1::text AND mc.marketid = $2::text AND m.accountid = $3::text
        LIMIT 1
      `,
      channelId,
      marketId,
      accountId
    );
    const channelRow = channelRows?.[0];
    if (!channelRow) {
      return res.status(404).json({ message: 'Canal de marché introuvable' });
    }

    const platformAccounts = await listPlatformAccountsForAccount(accountId);
    const updates = [];
    const params = [];
    let index = 1;
    if (req.body?.platformAccountId !== undefined) {
      updates.push(`platformaccountid = $${index++}::text`);
      params.push(pickPlatformAccountId(platformAccounts, channelRow.platformkey, req.body.platformAccountId));
    }
    if (req.body?.status !== undefined) {
      updates.push(`status = $${index++}::text`);
      params.push(String(req.body.status || '').trim() || channelRow.status);
    }
    if (req.body?.isEnabled !== undefined) {
      updates.push(`isenabled = $${index++}::boolean`);
      params.push(req.body.isEnabled !== false);
    }
    if (req.body?.settingsJson !== undefined || req.body?.settings !== undefined) {
      const settingsJson = {
        ...parseJsonObject(channelRow.settingsjson),
        ...parseJsonObject(req.body.settingsJson || req.body.settings || {}),
      };
      if (normalizePlatformKey(channelRow.platformkey) === 'amazon' && !settingsJson.legacyChannelKey) {
        const legacyChannelKey = inferAmazonChannelKeyForMarket(channelRow.marketcode);
        if (legacyChannelKey) settingsJson.legacyChannelKey = legacyChannelKey;
      }
      updates.push(`settingsjson = $${index++}::jsonb`);
      params.push(JSON.stringify(settingsJson));
    }
    if (updates.length === 0) {
      const markets = await getHydratedMarketsForAccount(accountId);
      return res.json({ market: markets.find((entry) => entry.id === marketId) || null });
    }

    updates.push('updatedat = NOW()');
    params.push(channelId);
    await prisma.$executeRawUnsafe(
      `UPDATE "MarketChannel" SET ${updates.join(', ')} WHERE id = $${index}::text`,
      ...params
    );
    await syncDestinationsForMarket(accountId, marketId);
    const markets = await getHydratedMarketsForAccount(accountId);
    res.json({ market: markets.find((entry) => entry.id === marketId) || null });
  } catch (error) {
    console.error('PATCH /markets/:marketId/channels/:channelId error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la mise à jour du canal du marché' });
  }
});

app.get('/api/v1/markets/:marketId/readiness', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === req.params.marketId);
    if (!market) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }
    res.json({ readiness: market.readiness, market });
  } catch (error) {
    console.error('GET /markets/:marketId/readiness error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors du calcul de la readiness du marché' });
  }
});

// GET /api/v1/markets/:marketId/preview?productId=<feedItemId>&localeId=<marketLocaleId>&refresh=1
//
// Renvoie côte à côte le produit source et sa version traduite pour la
// locale par défaut (ou la locale demandée) du marché. Sert au composant
// MarketPreviewPanel côté front. La traduction est mise en cache via la
// table AICache (cf. ai/ai-wrapper.js) — `refresh=1` la bypass.
app.get('/api/v1/markets/:marketId/preview', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.user.accountId || req.accountId;
    const { marketId } = req.params;
    const productId = String(req.query.productId || '').trim();
    const requestedLocaleId = String(req.query.localeId || '').trim();
    const forceRefresh = String(req.query.refresh || '').trim() === '1';

    if (!productId) {
      return res.status(400).json({ message: 'Paramètre productId requis' });
    }

    // 1. Marché + locales + vérification d'ownership.
    await ensureMarketsBackfillForAccount(accountId);
    const markets = await getHydratedMarketsForAccount(accountId);
    const market = markets.find((entry) => entry.id === marketId);
    if (!market) {
      return res.status(404).json({ message: 'Marché introuvable' });
    }
    const locales = Array.isArray(market.locales) ? market.locales : [];
    if (locales.length === 0) {
      return res.status(400).json({ message: 'Aucune locale configurée pour ce marché.' });
    }
    const targetLocale = requestedLocaleId
      ? locales.find((entry) => entry.id === requestedLocaleId)
      : (locales.find((entry) => entry.isDefault) || locales[0]);
    if (!targetLocale) {
      return res.status(404).json({ message: 'Locale introuvable pour ce marché.' });
    }

    // 2. Chargement du produit en vérifiant qu'il appartient bien à l'account.
    const productRows = await prisma.$queryRawUnsafe(
      `SELECT i.id, i.title, i.descriptionhtml, i.descriptiontext, i.brand, i.sku, i.imageurl, i.url, i.price, i.currency
       FROM "FeedItem" i
       JOIN "Feed" f ON f.id = i.feedid
       WHERE i.id = $1::text AND f.accountid = $2::text
       LIMIT 1`,
      productId,
      accountId
    );
    if (!productRows || productRows.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable dans votre catalogue.' });
    }
    const row = productRows[0];
    const product = {
      id: row.id,
      title: row.title || '',
      descriptionText: row.descriptiontext || '',
      descriptionHtml: row.descriptionhtml || '',
      brand: row.brand || '',
      sku: row.sku || '',
      imageUrl: row.imageurl || '',
      url: row.url || '',
      price: row.price,
      currency: row.currency || market.defaultCurrencyCode,
    };

    // 3. Appel du service de traduction.
    const result = await translateProductForMarket(prisma, product, targetLocale, { forceRefresh });

    res.json({
      market: { id: market.id, code: market.code, name: market.name },
      locale: {
        id: targetLocale.id,
        localeCode: targetLocale.localeCode,
        languageCode: targetLocale.languageCode,
        countryCode: targetLocale.countryCode,
        translationMode: targetLocale.translationMode,
        isDefault: !!targetLocale.isDefault,
      },
      product: { id: product.id, sku: product.sku, brand: product.brand, imageUrl: product.imageUrl, url: product.url, price: product.price, currency: product.currency },
      source: { title: product.title, descriptionText: product.descriptionText },
      translated: result.translated,
      meta: {
        mode: result.mode,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        cached: result.cached,
        provider: result.provider,
        cost: result.cost,
        tokensUsed: result.tokensUsed,
      },
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('GET /markets/:marketId/preview error:', error);
    const unavailable = getMarketsUnavailableResponse(res, error);
    if (unavailable) return unavailable;
    res.status(500).json({ message: 'Erreur lors de la prévisualisation du marché.', error: error?.message });
  }
});
}

module.exports = { registerMarketsRoutes };
