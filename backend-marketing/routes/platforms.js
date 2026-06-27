/**
 * Routes du domaine "platforms" (38 routes /api/v1/platforms/...) : OAuth GMC,
 * Google Ads, Amazon LWA + canaux Amazon, Google Local Inventory Ads (LIA) +
 * intégration Shopify POS, push/export GMC & Amazon, statut/déconnexion des
 * plateformes, historique des exports.
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/enrichment.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en
 * tête de chaque handler utilisant Prisma :
 * `const prisma = getPrisma(); const prismaReady = getPrismaReady();` pour
 * résoudre la valeur vivante du client Prisma (réassigné pendant l'init de
 * run()) sans réécrire les références. Toutes les dépendances du scope de run()
 * (middlewares d'accès, helpers OAuth/connecteurs, secret crypto, helpers de
 * push extraits, scheduler GMC, etc.) sont injectées via `deps`. Leurs
 * définitions RESTENT dans server-minimal.js. AUCUN changement de comportement.
 */
function registerPlatformsRoutes(app, {
  getPrisma,
  getPrismaReady,
  AMAZON_APPLICATION_ID,
  AMAZON_CHANNEL_CONFIG,
  AMAZON_LOGIN_URI,
  AMAZON_LWA_CLIENT_ID,
  AMAZON_LWA_CLIENT_SECRET,
  AMAZON_REDIRECT_URI,
  AMAZON_SELLER_CENTRAL_BASE,
  AMAZON_STATE_TTL_MS,
  APP_URL,
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REDIRECT_URI,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT,
  OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
  OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
  OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
  OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE,
  OAUTH_EPHEMERAL_PROVIDER_AMAZON,
  OAUTH_EPHEMERAL_PROVIDER_GMC,
  OAuth2Client,
  authenticateJwtOrShopifySession,
  buildDashboardRedirectUrl,
  buildEmbeddedShopifyAdminRedirectUrl,
  buildFluxRedirectUrl,
  buildSurfaceReturnRedirectUrl,
  checkChannelLimit,
  consumeOAuthEphemeralState,
  countChannelsForAccount,
  crypto,
  decryptSecret,
  encryptSecret,
  executeAmazonPush,
  executeGmcPush,
  executeLiaShopifySync,
  getDestinationPushContext,
  normalizeAppLocale,
  normalizeDashboardReturnTo,
  normalizeEmbeddedReturnTo,
  parseJsonObject,
  readOAuthEphemeralState,
  requireAuth,
  respondLiaScopeMissing,
  revokeGoogleOAuthToken,
  saveGmcConnection,
  scheduleAutoGmcPush,
  storeOAuthEphemeralState,
  upsertPlatformConnection,
}) {
// 0. Diagnostic OAuth (redirect_uri à ajouter dans la Console Google)
app.get('/api/v1/platforms/gmc/oauth-config', requireAuth, (req, res) => {
  res.json({
    redirectUri: GOOGLE_REDIRECT_URI,
    hint: 'Ajoutez exactement cette URL dans Google Cloud Console → APIs & Services → Identifiants → Client OAuth 2.0 → URI de redirection autorisés',
  });
});

// 1. Générer l'URL d'autorisation OAuth2 GMC
app.get('/api/v1/platforms/gmc/auth-url', authenticateJwtOrShopifySession, async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Connexion Google Merchant Center non configurée.' });
  }
  const scopes = [
    'https://www.googleapis.com/auth/content',         // Content API (produits)
    'https://www.googleapis.com/auth/userinfo.email'    // Email utilisateur
  ];
  const locale = normalizeAppLocale(req.query.locale);
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(req.query.returnTo, ''); // '' → le callback retombe sur /flux
  const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

  // State CSRF : on stocke le payload en base derrière un UUID opaque au lieu
  // de l'embarquer dans le state OAuth (qui pouvait être forgé par un tiers).
  const stateId = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: stateId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
      payload: {
        accountId: req.accountId,
        locale,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: 10 * 60 * 1000,
    });
  } catch (stateError) {
    console.error('GMC auth-url state store:', stateError);
    return res.status(503).json({ message: 'Connexion Google Merchant Center temporairement indisponible.' });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: scopes,
    state: stateId,
  });

  res.json({ authUrl });
});

// 2. Callback OAuth2 — échangez le code contre des tokens
app.get('/api/v1/platforms/gmc/callback', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { code, state } = req.query;
    const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');

    if (!code) {
      return res.redirect(buildFluxRedirectUrl(appUrl, 'fr', { gmc: 'error', message: 'Code OAuth Google manquant.' }));
    }

    let accountId;
    let auditShareToken;
    let auditLocale = 'fr';
    let dashboardLocale = 'fr';
    let embeddedSurface = false;
    let embeddedReturnTo = '/embedded/channels';
    // On récupère le payload via l'UUID opaque stocké côté serveur — il a été
    // émis par nous, à usage unique, et expire en 10 min (CSRF guard).
    let stateData;
    try {
      stateData = await consumeOAuthEphemeralState({
        id: String(state || ''),
        provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
        flow: OAUTH_EPHEMERAL_FLOW_GMC_OAUTH_STATE,
      });
    } catch (stateError) {
      console.error('GMC callback state lookup:', stateError);
      return res.redirect(buildFluxRedirectUrl(appUrl, 'fr', { gmc: 'error', message: 'Etat OAuth Google invalide.' }));
    }
    if (!stateData) {
      return res.redirect(buildFluxRedirectUrl(appUrl, 'fr', { gmc: 'error', message: 'Etat OAuth Google invalide ou expiré.' }));
    }
    accountId = stateData.accountId;
    auditShareToken = stateData.auditShareToken;
    auditLocale = normalizeAppLocale(stateData.locale || 'fr');
    dashboardLocale = normalizeAppLocale(stateData.locale || 'fr');
    embeddedSurface = stateData.surface === 'embedded';
    embeddedReturnTo = normalizeEmbeddedReturnTo(stateData.returnTo, '/embedded/channels');

    if (!accountId && !auditShareToken) {
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
            gmc: 'error',
            message: 'Compte FeedPlug manquant pour la connexion GMC.',
          }),
          params: {
            gmc: 'error',
            message: 'Compte FeedPlug manquant pour la connexion GMC.',
          },
        }));
      }
      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
        gmc: 'error',
        message: 'Compte FeedPlug manquant pour la connexion GMC.',
      }));
    }
    
    const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    
    // Échanger le code contre des tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Récupérer l'email de l'utilisateur Google
    let email = '';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        email = userInfo.email || '';
      }
    } catch {}
    
    // Récupérer les comptes Merchant Center disponibles
    let merchantName = '';
    let merchantOptions = [];
    try {
      const accountsRes = await fetch('https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        merchantOptions = parseGmcMerchantOptions(accountsData);
        merchantOptions = await enrichGmcMerchantNames(merchantOptions, tokens.access_token);
        if (merchantOptions.length > 0) {
          merchantName = merchantOptions[0].merchantName || '';
        }
      }
    } catch (e) {
      console.warn('Erreur récupération comptes MC:', e.message);
    }

    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    const encryptedAccessToken = tokens.access_token ? encryptSecret(tokens.access_token) : null;
    const encryptedRefreshToken = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null;
    const selectedMerchant = merchantOptions[0] || null;

    if (!selectedMerchant?.merchantId) {
      if (auditShareToken) {
        return res.redirect(`${appUrl}/${auditLocale}/audit-flux/${auditShareToken}?error=no_merchant_account`);
      }
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
            gmc: 'error',
            message: 'Aucun Merchant Center accessible n’a ete trouve pour ce compte Google.',
          }),
          params: {
            gmc: 'error',
            message: 'Aucun Merchant Center accessible n’a ete trouve pour ce compte Google.',
          },
        }));
      }
      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
        gmc: 'error',
        message: 'Aucun Merchant Center accessible n’a ete trouve pour ce compte Google.',
      }));
    }

    if (accountId && merchantOptions.length > 1) {
      const selectionId = crypto.randomUUID();
      await storeOAuthEphemeralState({
        id: selectionId,
        provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
        flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
        payload: {
          accountId,
          locale: dashboardLocale,
          email,
          merchants: merchantOptions,
          tokenExpiry: expiry,
          encryptedAccessToken,
          encryptedRefreshToken,
          scope: tokens.scope || '',
        },
        ttlMs: GMC_SELECTION_TTL_MS,
      });

      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
            gmc: 'select',
            selection: selectionId,
          }),
          params: {
            gmc: 'select',
            selection: selectionId,
          },
        }));
      }

      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
        gmc: 'select',
        selection: selectionId,
      }));
    }
    
    // Sauvegarder la connexion en base
    if (prismaReady && prisma && accountId) {
      await saveGmcConnection({
        accountId,
        merchant: selectedMerchant,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiry: expiry,
        email,
        scope: tokens.scope || '',
      });
      // Premier push immédiat : le marchand attend de voir ses produits dans
      // Merchant Center dès la connexion, sans passer par la page Flux.
      scheduleAutoGmcPush(accountId, null, 'connexion GMC', 0);
    }
    
    if (prismaReady && prisma && auditShareToken) {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, auditShareToken);
      if (rows?.length) {
        const audit = rows[0];
        const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
        input.gmcConnection = {
          merchantId: selectedMerchant.merchantId || null,
          email,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiry: expiry,
          connectedAt: new Date().toISOString(),
          merchantName: selectedMerchant.merchantName || merchantName || '',
        };
        await prisma.$executeRawUnsafe(`
          UPDATE marketing_audits
          SET merchantid = COALESCE($1::text, merchantid),
              connectortype = 'GMC',
              inputjson = $2::jsonb,
              status = 'source_connected',
              "updatedAt" = NOW()
          WHERE sharetoken = $3::text
        `, selectedMerchant.merchantId || null, stringifyEncryptedJson(input), auditShareToken);
      }
      return res.redirect(`${appUrl}/${auditLocale}/audit-flux/${auditShareToken}?gmc=connected`);
    }

    // Rediriger vers le frontend avec succès (APP_URL pour multi-env)
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: buildFluxRedirectUrl(appUrl, dashboardLocale, {
          gmc: 'connected',
          merchant: selectedMerchant.merchantId || '',
        }),
        params: {
          gmc: 'connected',
          merchant: selectedMerchant.merchantId || '',
        },
      }));
    }

    res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, buildLocalizedAppUrl(appUrl, dashboardLocale, '/flux'), {
      gmc: 'connected',
      merchant: selectedMerchant.merchantId || '',
    }));
  } catch (error) {
    console.error('GMC OAuth callback error:', error);
    const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
    res.redirect(buildFluxRedirectUrl(appUrl, 'fr', {
      gmc: 'error',
      message: error.message || 'Connexion Google Merchant Center impossible.',
    }));
  }
});

// 3. Statut de la connexion GMC
app.get('/api/v1/platforms/gmc/status', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.json({ connected: false });
    }
    
    const connections = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'gmc'
    `, req.accountId);
    
    if (!connections || connections.length === 0) {
      return res.json({ connected: false });
    }
    
    const conn = connections[0];
    const isExpired = conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date();
    const metadata = parseJsonObject(conn.metadata);
    
    res.json({
      connected: conn.status === 'active',
      merchantId: conn.merchantid,
      merchantName: metadata.merchantName || '',
      email: conn.email,
      tokenExpired: isExpired,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// 4. Déconnecter GMC
app.delete('/api/v1/platforms/gmc/disconnect', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (prismaReady && prisma) {
      const connections = await prisma.$queryRawUnsafe(`
        SELECT accesstoken, refreshtoken
        FROM "PlatformConnection"
        WHERE accountid = $1::text AND platform = 'gmc'
        LIMIT 1
      `, req.accountId);

      if (connections?.length) {
        await revokeGoogleOAuthToken(
          decryptSecret(connections[0].refreshtoken) || decryptSecret(connections[0].accesstoken)
        );
      }

      await prisma.$executeRawUnsafe(`
        DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'gmc'
      `, req.accountId);
    }
    res.json({ disconnected: true, message: 'Google Merchant Center déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/v1/platforms/gmc/selection/:selectionId', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const selectionId = String(req.params.selectionId || '').trim();
    if (!selectionId) {
      return res.status(400).json({ message: 'Selection GMC manquante.' });
    }

    const payload = await readOAuthEphemeralState({
      id: selectionId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
    });

    if (!payload || payload.accountId !== req.accountId) {
      return res.status(404).json({ message: 'Cette selection GMC a expire ou n’est plus disponible.' });
    }

    res.json({
      selectionId,
      email: payload.email || '',
      merchants: Array.isArray(payload.merchants) ? payload.merchants : [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Impossible de charger la selection GMC.' });
  }
});

app.post('/api/v1/platforms/gmc/select-merchant', authenticateJwtOrShopifySession, async (req, res) => {
  try {
    const selectionId = String(req.body?.selectionId || '').trim();
    const merchantId = String(req.body?.merchantId || '').trim();

    if (!selectionId || !merchantId) {
      return res.status(400).json({ message: 'selectionId et merchantId sont requis.' });
    }

    const payload = await readOAuthEphemeralState({
      id: selectionId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
    });

    if (!payload || payload.accountId !== req.accountId) {
      return res.status(404).json({ message: 'Cette selection GMC a expire ou n’est plus disponible.' });
    }

    const merchants = Array.isArray(payload.merchants) ? payload.merchants : [];
    const selectedMerchant = merchants.find((entry) => String(entry?.merchantId || '') === merchantId);
    if (!selectedMerchant) {
      return res.status(400).json({ message: 'Merchant Center introuvable dans cette selection.' });
    }

    await saveGmcConnection({
      accountId: req.accountId,
      merchant: selectedMerchant,
      encryptedAccessToken: payload.encryptedAccessToken || null,
      encryptedRefreshToken: payload.encryptedRefreshToken || null,
      tokenExpiry: payload.tokenExpiry || null,
      email: payload.email || '',
      scope: payload.scope || '',
    });

    await consumeOAuthEphemeralState({
      id: selectionId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GMC_SELECTION,
    });

    // Premier push immédiat après le choix du compte Merchant Center.
    scheduleAutoGmcPush(req.accountId, null, 'connexion GMC', 0);

    res.json({
      connected: true,
      merchantId: selectedMerchant.merchantId,
      merchantName: selectedMerchant.merchantName || '',
      email: payload.email || '',
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Impossible de finaliser la connexion GMC.' });
  }
});

// ===== GOOGLE ADS — Connexion OAuth2 pour sync performance (shopping_performance_view) =====
app.get('/api/v1/platforms/google-ads/auth-url', authenticateJwtOrShopifySession, async (req, res) => {
  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Connexion Google Ads non configurée (GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET).' });
  }
  const scopes = ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/userinfo.email'];
  const oauth2Client = new OAuth2Client(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REDIRECT_URI);
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(req.query.returnTo, ''); // '' → le callback retombe sur /performance
  const stateId = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: stateId,
      provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
      flow: OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE,
      payload: {
        accountId: req.accountId,
        platform: 'google_ads',
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: 10 * 60 * 1000,
    });
  } catch (stateError) {
    console.error('Google Ads auth-url state store:', stateError);
    return res.status(503).json({ message: 'Connexion Google Ads temporairement indisponible.' });
  }
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: stateId,
  });
  res.json({ authUrl });
});

app.get('/api/v1/platforms/google-ads/callback', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  const appUrl = (process.env.APP_URL || 'https://app.feedplug.com').replace(/\/$/, '');
  const performanceRedirect = `${appUrl}/performance`;
  let stateData = null;
  try {
    const { code, state } = req.query;
    if (!code) return res.redirect(`${performanceRedirect}?error=no_code`);
    try {
      stateData = await consumeOAuthEphemeralState({
        id: String(state || ''),
        provider: OAUTH_EPHEMERAL_PROVIDER_GMC,
        flow: OAUTH_EPHEMERAL_FLOW_GOOGLE_ADS_OAUTH_STATE,
      });
    } catch (stateError) {
      console.error('Google Ads callback state lookup:', stateError);
      return res.redirect(`${performanceRedirect}?error=invalid_state`);
    }
    if (!stateData) {
      return res.redirect(`${performanceRedirect}?error=invalid_state`);
    }
    const accountId = stateData.accountId;
    const embeddedSurface = stateData.surface === 'embedded';
    const embeddedReturnTo = normalizeEmbeddedReturnTo(stateData.returnTo, '/embedded/channels');
    if (!accountId || !GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET) {
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: `${performanceRedirect}?error=config`,
          params: { google_ads: 'error', message: 'Configuration Google Ads manquante.' },
        }));
      }
      return res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, performanceRedirect, {
        google_ads: 'error',
        error: 'config',
        message: 'Configuration Google Ads manquante.',
      }));
    }
    const oauth2Client = new OAuth2Client(GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REDIRECT_URI);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    let email = '';
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        email = userInfo.email || '';
      }
    } catch {}
    let customerId = null;
    try {
      const listRes = await fetch('https://googleads.googleapis.com/v16/customers:listAccessibleCustomers', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      if (listRes.ok) {
        const data = await listRes.json();
        if (data.resourceNames && data.resourceNames.length > 0) {
          const r = data.resourceNames[0];
          customerId = r.replace(/^customers\//, '');
        }
      }
    } catch (e) {
      console.warn('List accessible customers Google Ads:', e.message);
    }
    if (prismaReady && prisma) {
      const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
      await upsertPlatformConnection({
        accountId,
        platform: 'google_ads',
        merchantId: customerId || '',
        accessToken: encryptSecret(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
        tokenExpiry: expiry,
        email,
        status: 'active',
        metadata: {},
      });
    }
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${performanceRedirect}?google_ads=connected&customer=${customerId || ''}`,
        params: { google_ads: 'connected', customer: customerId || '' },
      }));
    }

    res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData.returnTo, performanceRedirect, {
      google_ads: 'connected',
      customer: customerId || '',
    }));
  } catch (error) {
    console.error('Google Ads OAuth callback error:', error);
    if (stateData?.surface === 'embedded') {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId: stateData.accountId,
        returnTo: normalizeEmbeddedReturnTo(stateData.returnTo, '/embedded/channels'),
        fallbackUrl: `${appUrl}/performance?error=oauth_failed&message=${encodeURIComponent(error.message)}`,
        params: { google_ads: 'error', message: error.message || 'Connexion Google Ads impossible.' },
      }));
    }
    res.redirect(buildSurfaceReturnRedirectUrl(appUrl, stateData?.returnTo, performanceRedirect, {
      google_ads: 'error',
      error: 'oauth_failed',
      message: error.message || 'Connexion Google Ads impossible.',
    }));
  }
});

app.get('/api/v1/platforms/google-ads/status', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.json({ connected: false });
    const connections = await prisma.$queryRawUnsafe(
      `SELECT merchantid, email, status, createdat FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'google_ads'`,
      req.accountId
    );
    if (!connections || connections.length === 0) return res.json({ connected: false });
    const conn = connections[0];
    res.json({
      connected: conn.status === 'active',
      customerId: conn.merchantid,
      email: conn.email,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

app.delete('/api/v1/platforms/google-ads/disconnect', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (prismaReady && prisma) {
      await prisma.$executeRawUnsafe(`DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'google_ads'`, req.accountId);
    }
    res.json({ message: 'Google Ads déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== AMAZON — Canaux (FR, UK, DE, IT, ES) + Export =====
// 1. Liste des canaux Amazon du compte
app.get('/api/v1/platforms/amazon/channels', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.json({ channels: [] });
    }
    const channels = await prisma.$queryRawUnsafe(`
      SELECT id, platform, channelkey, label, config, isactive, createdat
      FROM "ExportChannel"
      WHERE accountid = $1::text AND platform = 'amazon' AND isactive = true
      ORDER BY channelkey
    `, req.accountId);
    res.json({ channels: channels || [] });
  } catch (error) {
    console.error('Amazon channels list error:', error);
    res.status(500).json({ message: error.message, channels: [] });
  }
});

// 2. Créer un canal Amazon (amazon_fr, amazon_uk, amazon_de, amazon_it, amazon_es)
app.post('/api/v1/platforms/amazon/channels', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { channelKey } = req.body || {};
    const key = (channelKey || '').toLowerCase();
    if (!AMAZON_CHANNEL_CONFIG[key]) {
      return res.status(400).json({
        message: 'Canal invalide. Utilisez channelKey: amazon_fr, amazon_uk, amazon_de, amazon_it ou amazon_es'
      });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const currentChannels = await countChannelsForAccount(prisma, req.accountId);
    const channelLimit = await checkChannelLimit(prisma, req.accountId, currentChannels);
    if (!channelLimit.allowed) {
      return res.status(403).json({ code: 'PLAN_LIMIT', message: channelLimit.message });
    }
    const config = AMAZON_CHANNEL_CONFIG[key];
    const channelId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ExportChannel" (id, accountid, platform, channelkey, label, config, isactive, createdat, updatedat)
      VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::jsonb, true, NOW(), NOW())
      ON CONFLICT (accountid, platform, channelkey) DO UPDATE SET
        label = $4::text,
        config = $5::jsonb,
        isactive = true,
        updatedat = NOW()
    `, channelId, req.accountId, key, config.label, JSON.stringify(config));
    const [created] = await prisma.$queryRawUnsafe(`
      SELECT id, platform, channelkey, label, config, isactive, createdat
      FROM "ExportChannel"
      WHERE accountid = $1::text AND platform = 'amazon' AND channelkey = $2::text
    `, req.accountId, key);
    res.status(201).json(created || { channelKey: key, label: config.label });
  } catch (error) {
    console.error('Amazon channel create error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 3. Supprimer (désactiver) un canal Amazon
app.delete('/api/v1/platforms/amazon/channels/:channelKey', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const key = (req.params.channelKey || '').toLowerCase();
    if (!AMAZON_CHANNEL_CONFIG[key]) {
      return res.status(400).json({ message: 'Canal invalide' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "ExportChannel" SET isactive = false, updatedat = NOW()
      WHERE accountid = $1::text AND platform = 'amazon' AND channelkey = $2::text
    `, req.accountId, key);
    res.json({ message: `Canal ${key} désactivé` });
  } catch (error) {
    console.error('Amazon channel delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Canaux disponibles (référence, sans compte)
app.get('/api/v1/platforms/amazon/channels/available', (_req, res) => {
  res.json({
    channels: Object.entries(AMAZON_CHANNEL_CONFIG).map(([k, v]) => ({
      channelKey: k,
      label: v.label,
      marketplaceId: v.marketplaceId,
      currency: v.currency,
      countryCode: v.countryCode
    }))
  });
});

// ===== GOOGLE LOCAL INVENTORY ADS (LIA) — Magasins + inventaire par magasin =====
// 1. Liste des magasins actifs du compte
app.get('/api/v1/platforms/lia/stores', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.json({ stores: [] });
    }
    const stores = await prisma.$queryRawUnsafe(`
      SELECT id, storecode AS "storeCode", name, address, isactive AS "isActive", createdat AS "createdAt"
      FROM "StoreLocation"
      WHERE accountid = $1::text AND isactive = true
      ORDER BY storecode
    `, req.accountId);
    res.json({ stores: stores || [] });
  } catch (error) {
    console.error('LIA stores list error:', error);
    res.status(500).json({ message: error.message, stores: [] });
  }
});

// 2. Créer / mettre à jour un magasin (storeCode = code magasin Google Business Profile)
app.post('/api/v1/platforms/lia/stores', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { validateStoreInput } = require('./lib/local-inventory');
    const validation = validateStoreInput(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const { storeCode, name, address } = validation.value;
    const storeId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "StoreLocation" (id, accountid, storecode, name, address, isactive, createdat, updatedat)
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, true, NOW(), NOW())
      ON CONFLICT (accountid, storecode) DO UPDATE SET
        name = $4::text,
        address = $5::text,
        isactive = true,
        updatedat = NOW()
    `, storeId, req.accountId, storeCode, name, address);
    const [created] = await prisma.$queryRawUnsafe(`
      SELECT id, storecode AS "storeCode", name, address, isactive AS "isActive", createdat AS "createdAt"
      FROM "StoreLocation"
      WHERE accountid = $1::text AND storecode = $2::text
    `, req.accountId, storeCode);
    res.status(201).json(created || { storeCode, name, address });
  } catch (error) {
    console.error('LIA store create error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 3. Supprimer (désactiver) un magasin
app.delete('/api/v1/platforms/lia/stores/:storeCode', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { normalizeStoreCode } = require('./lib/local-inventory');
    const storeCode = normalizeStoreCode(req.params.storeCode);
    if (!storeCode) {
      return res.status(400).json({ message: 'Code magasin invalide' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "StoreLocation" SET isactive = false, updatedat = NOW()
      WHERE accountid = $1::text AND storecode = $2::text
    `, req.accountId, storeCode);
    res.json({ message: `Magasin ${storeCode} désactivé` });
  } catch (error) {
    console.error('LIA store delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Inventaire par magasin — lecture (filtre optionnel ?storeCode=)
app.get('/api/v1/platforms/lia/inventory', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.json({ inventory: [] });
    }
    const { normalizeStoreCode } = require('./lib/local-inventory');
    const requestedStoreCode = req.query.storeCode ? normalizeStoreCode(req.query.storeCode) : null;
    if (req.query.storeCode && !requestedStoreCode) {
      return res.status(400).json({ message: 'Code magasin invalide' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);
    const params = [req.accountId];
    let where = 'accountid = $1::text';
    if (requestedStoreCode) {
      params.push(requestedStoreCode);
      where += ' AND storecode = $2::text';
    }
    params.push(limit);
    const inventory = await prisma.$queryRawUnsafe(`
      SELECT storecode AS "storeCode", offerid AS "offerId", quantity, availability,
             price, saleprice AS "salePrice", pickupmethod AS "pickupMethod", pickupsla AS "pickupSla",
             updatedat AS "updatedAt"
      FROM "LocalInventory"
      WHERE ${where}
      ORDER BY storecode, offerid
      LIMIT $${params.length}::int
    `, ...params);
    res.json({ inventory: inventory || [] });
  } catch (error) {
    console.error('LIA inventory list error:', error);
    res.status(500).json({ message: error.message, inventory: [] });
  }
});

// 5. Inventaire par magasin — upsert en masse { rows: [{ storeCode, offerId, quantity, ... }] }
app.post('/api/v1/platforms/lia/inventory', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { validateInventoryRows } = require('./lib/local-inventory');
    const validation = validateInventoryRows(req.body?.rows);
    if (!validation.ok) {
      return res.status(400).json({ message: 'Lignes d\'inventaire invalides', errors: validation.errors.slice(0, 20) });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    // Les codes magasins référencés doivent exister (et être actifs) sur le compte
    const stores = await prisma.$queryRawUnsafe(`
      SELECT storecode FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true
    `, req.accountId);
    const knownStores = new Set((stores || []).map(s => s.storecode));
    const unknown = [...new Set(validation.rows.map(r => r.storeCode).filter(code => !knownStores.has(code)))];
    if (unknown.length > 0) {
      return res.status(400).json({ message: `Magasins inconnus : ${unknown.slice(0, 10).join(', ')}. Créez-les d'abord.` });
    }
    const CHUNK = 500;
    for (let offset = 0; offset < validation.rows.length; offset += CHUNK) {
      const chunk = validation.rows.slice(offset, offset + CHUNK);
      const values = [];
      const params = [req.accountId];
      for (const row of chunk) {
        const base = params.length;
        params.push(crypto.randomUUID(), row.storeCode, row.offerId, row.quantity, row.availability, row.price, row.salePrice, row.pickupMethod, row.pickupSla);
        values.push(`($${base + 1}::text, $1::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::int, $${base + 5}::text, $${base + 6}::numeric, $${base + 7}::numeric, $${base + 8}::text, $${base + 9}::text, NOW(), NOW())`);
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "LocalInventory" (id, accountid, storecode, offerid, quantity, availability, price, saleprice, pickupmethod, pickupsla, createdat, updatedat)
        VALUES ${values.join(', ')}
        ON CONFLICT (accountid, storecode, offerid) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          availability = EXCLUDED.availability,
          price = EXCLUDED.price,
          saleprice = EXCLUDED.saleprice,
          pickupmethod = EXCLUDED.pickupmethod,
          pickupsla = EXCLUDED.pickupsla,
          updatedat = NOW()
      `, ...params);
    }
    res.json({ message: `${validation.rows.length} ligne(s) d'inventaire enregistrée(s)`, upserted: validation.rows.length });
  } catch (error) {
    console.error('LIA inventory upsert error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 7. URL publique du flux LIA pour configuration Google Merchant Center.
// Retourne l'URL d'export prête à coller dans GMC (Feeds → Add primary feed).
// Une URL globale + une URL par store actif (au cas où le merchant configure
// un flux par magasin dans GMC).
app.get('/api/v1/platforms/lia/feed-url', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const feedRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Feed" WHERE accountid = $1::text AND status = 'ACTIVE'::text ORDER BY createdat ASC LIMIT 1`,
      req.accountId
    );
    const feedId = feedRows?.[0]?.id;
    if (!feedId) {
      return res.status(404).json({
        message: 'Aucun flux actif sur ce compte. Synchronisez d\'abord votre catalogue.',
      });
    }
    const stores = await prisma.$queryRawUnsafe(
      `SELECT storecode AS "storeCode" FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true ORDER BY storecode`,
      req.accountId
    );
    const apiBase = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const globalUrl = `${apiBase}/api/v1/ingestion/feeds/${encodeURIComponent(feedId)}/export?platform=lia&format=csv`;
    const perStoreUrls = (stores || []).map((s) => ({
      storeCode: s.storeCode,
      url: `${globalUrl}&storeCode=${encodeURIComponent(s.storeCode)}`,
    }));
    return res.json({
      feedId,
      globalUrl,
      perStoreUrls,
      stores: stores?.length || 0,
    });
  } catch (error) {
    console.error('LIA feed-url error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 6. Inventaire par magasin — DELETE unitaire (1 store × 1 offre)
app.delete('/api/v1/platforms/lia/inventory/:storeCode/:offerId', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { normalizeStoreCode } = require('./lib/local-inventory');
    const storeCode = normalizeStoreCode(req.params.storeCode);
    if (!storeCode) {
      return res.status(400).json({ message: 'Code magasin invalide' });
    }
    const offerId = String(req.params.offerId || '').trim();
    if (!offerId) {
      return res.status(400).json({ message: 'offerId manquant' });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    await prisma.$executeRawUnsafe(`
      DELETE FROM "LocalInventory"
      WHERE accountid = $1::text AND storecode = $2::text AND offerid = $3::text
    `, req.accountId, storeCode, offerId);
    res.json({ message: `Ligne d'inventaire supprimée (${storeCode} × ${offerId})` });
  } catch (error) {
    console.error('LIA inventory delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 8. Emplacements Shopify du marchand + mapping actuel vers les magasins LIA.
app.get('/api/v1/platforms/lia/shopify/locations', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const access = await getShopifyAdminAccessForAccount(req.accountId);
    if (!access) {
      return res.status(404).json({ message: 'Aucune boutique Shopify connectée à ce compte.' });
    }
    const data = await shopifyAdminGraphql({
      ...access,
      query: `
        query LiaLocations {
          locations(first: 50, includeInactive: false) {
            edges { node { id name fulfillsOnlineOrders address { formatted } } }
          }
        }
      `,
    });
    const mappings = await prisma.$queryRawUnsafe(
      `SELECT storecode, shopifylocationid FROM "StoreLocation" WHERE accountid = $1::text AND isactive = true AND shopifylocationid IS NOT NULL`,
      req.accountId
    );
    const storeCodeByLocation = new Map((mappings || []).map((m) => [m.shopifylocationid, m.storecode]));
    const locations = (data?.locations?.edges || []).map(({ node }) => ({
      id: node.id,
      name: node.name || '',
      address: Array.isArray(node.address?.formatted) ? node.address.formatted.join(', ') : '',
      fulfillsOnlineOrders: node.fulfillsOnlineOrders === true,
      storeCode: storeCodeByLocation.get(node.id) || null,
    }));
    res.json({ locations });
  } catch (error) {
    if (error?.scopeMissing) return respondLiaScopeMissing(res);
    console.error('LIA shopify locations error:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// 9. Lier un emplacement Shopify à un code magasin Google Business Profile.
app.post('/api/v1/platforms/lia/shopify/locations/link', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { validateStoreInput } = require('./lib/local-inventory');
    const locationId = String(req.body?.locationId || '').trim();
    if (!/^gid:\/\/shopify\/Location\/\d+$/.test(locationId)) {
      return res.status(400).json({ message: 'locationId Shopify invalide.' });
    }
    const validation = validateStoreInput(req.body || {});
    if (!validation.ok) {
      return res.status(400).json({ message: validation.error });
    }
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const { storeCode, name, address } = validation.value;
    // Un emplacement Shopify ne peut alimenter qu'un seul magasin LIA :
    // on détache l'éventuel mapping précédent avant l'upsert.
    await prisma.$executeRawUnsafe(
      `UPDATE "StoreLocation" SET shopifylocationid = NULL, updatedat = NOW() WHERE accountid = $1::text AND shopifylocationid = $2::text AND storecode <> $3::text`,
      req.accountId, locationId, storeCode
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO "StoreLocation" (id, accountid, storecode, name, address, shopifylocationid, isactive, createdat, updatedat)
      VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, true, NOW(), NOW())
      ON CONFLICT (accountid, storecode) DO UPDATE SET
        name = COALESCE($4::text, "StoreLocation".name),
        address = COALESCE($5::text, "StoreLocation".address),
        shopifylocationid = $6::text,
        isactive = true,
        updatedat = NOW()
    `, crypto.randomUUID(), req.accountId, storeCode, name, address, locationId);
    res.status(201).json({ storeCode, locationId });
  } catch (error) {
    console.error('LIA shopify link error:', error);
    res.status(500).json({ message: error.message });
  }
});

// 10. Sync manuelle du stock POS → inventaire LIA.
app.post('/api/v1/platforms/lia/shopify/sync', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const result = await executeLiaShopifySync(req.accountId);
    res.json({
      message: result.stores === 0
        ? 'Aucun emplacement Shopify lié à un magasin. Liez vos emplacements d\'abord.'
        : `${result.synced} ligne(s) de stock synchronisée(s) depuis ${result.stores} emplacement(s) Shopify`,
      ...result,
    });
  } catch (error) {
    if (error?.scopeMissing) return respondLiaScopeMissing(res);
    console.error('LIA shopify sync error:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// 5. Connexion Amazon — auth-url pour OAuth LWA
app.get('/api/v1/platforms/amazon/auth-url', authenticateJwtOrShopifySession, async (req, res) => {
  if (!AMAZON_APPLICATION_ID || !AMAZON_REDIRECT_URI || !AMAZON_LOGIN_URI) {
    // État normal (Amazon SP-API pas encore activé), pas une erreur
    // serveur : 200 + configured:false. Cf /connect-init pour la raison.
    return res.status(200).json({
      message: 'Amazon OAuth non configuré',
      configured: false
    });
  }
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels');
  const state = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: state,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
      payload: {
        accountId: req.accountId,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: AMAZON_STATE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon auth-url state persistence error:', error);
    return res.status(503).json({ message: 'Connexion Amazon temporairement indisponible', configured: true });
  }
  const authUrl = `${AMAZON_SELLER_CENTRAL_BASE}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_APPLICATION_ID)}&state=${encodeURIComponent(state)}`;
  res.json({ authUrl, state, configured: true });
});

// 5b. Log-in URI — reçoit Amazon (amazon_callback_uri, amazon_state, selling_partner_id), redirige vers Amazon
app.get('/api/v1/platforms/amazon/login', async (req, res) => {
  const { amazon_callback_uri, amazon_state, selling_partner_id } = req.query;
  if (!amazon_callback_uri || !amazon_state) {
    return res.status(400).send('Paramètres Amazon manquants (amazon_callback_uri, amazon_state)');
  }
  const accountId = req.cookies?.fp_amazon_connect_account;
  if (!accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=no_session`);
  }
  res.clearCookie('fp_amazon_connect_account', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  const state = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: state,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
      payload: { accountId, sellingPartnerId: selling_partner_id || null },
      ttlMs: AMAZON_STATE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon login state persistence error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=state_persist`);
  }
  const redirectUrl = `${amazon_callback_uri}?redirect_uri=${encodeURIComponent(AMAZON_REDIRECT_URI)}&amazon_state=${encodeURIComponent(amazon_state)}&state=${encodeURIComponent(state)}`;
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.redirect(redirectUrl);
});

// 5c. Redirect URI — reçoit code, échange pour tokens, stocke
app.get('/api/v1/platforms/amazon/callback', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  const { state, selling_partner_id, spapi_oauth_code } = req.query;
  if (!spapi_oauth_code || !state) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=missing_params`);
  }

  let stored = null;
  try {
    stored = await consumeOAuthEphemeralState({
      id: String(state),
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
    });
  } catch (error) {
    console.error('Amazon callback state lookup error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=state_lookup`);
  }
  if (!stored?.accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=invalid_state`);
  }
  const accountId = stored.accountId;
  const embeddedSurface = stored.surface === 'embedded';
  const embeddedReturnTo = normalizeEmbeddedReturnTo(stored.returnTo, '/embedded/channels');
  const sellerId = selling_partner_id || stored.sellingPartnerId || null;
  if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET || !AMAZON_REDIRECT_URI) {
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${APP_URL}/flux?amazon=error&reason=config`,
        params: { amazon: 'error', reason: 'config' },
      }));
    }
    return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'config' }));
  }
  try {
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: spapi_oauth_code,
        redirect_uri: AMAZON_REDIRECT_URI,
        client_id: AMAZON_LWA_CLIENT_ID,
        client_secret: AMAZON_LWA_CLIENT_SECRET
      }).toString()
    });
    // Amazon peut répondre 4xx/5xx (redirect_uri non enregistrée, client
    // invalide…) : on lit le corps brut pour le log avant de tenter le JSON,
    // sinon on masque la vraie cause derrière une erreur de parse opaque.
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '');
      console.error('Amazon token exchange HTTP error:', tokenRes.status, errBody.substring(0, 500));
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: `${APP_URL}/flux?amazon=error&reason=token_exchange`,
          params: { amazon: 'error', reason: 'token_exchange' },
        }));
      }
      return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'token_exchange' }));
    }
    const tokens = await tokenRes.json();
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('Amazon token exchange failed:', tokens);
      if (embeddedSurface) {
        return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
          accountId,
          returnTo: embeddedReturnTo,
          fallbackUrl: `${APP_URL}/flux?amazon=error&reason=token_exchange`,
          params: { amazon: 'error', reason: 'token_exchange' },
        }));
      }
      return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'token_exchange' }));
    }
    const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    if (prismaReady && prisma) {
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' LIMIT 1
      `, accountId);
      const connId = crypto.randomUUID();
      const meta = stringifyEncryptedJson({ sellerId });
      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE "PlatformConnection" SET merchantid = COALESCE($1::text, merchantid), accesstoken = $2::text, refreshtoken = COALESCE($3::text, refreshtoken),
          tokenexpiry = $4::timestamptz, status = 'active', metadata = $5::jsonb, updatedat = NOW()
          WHERE accountid = $6::text AND platform = 'amazon'
        `, sellerId || null, encryptSecret(tokens.access_token), encryptSecret(tokens.refresh_token), expiry, meta, accountId);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, status, metadata, createdat, updatedat)
          VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::text, $6::timestamptz, 'active', $7::jsonb, NOW(), NOW())
        `, connId, accountId, sellerId || null, encryptSecret(tokens.access_token), encryptSecret(tokens.refresh_token), expiry, meta);
      }
    }
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${APP_URL}/flux?amazon=connected&seller=${sellerId || ''}`,
        params: { amazon: 'connected', seller: sellerId || '' },
      }));
    }
    return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'connected', seller: sellerId || '' }));
  } catch (e) {
    console.error('Amazon callback error:', e);
    if (embeddedSurface) {
      return res.redirect(await buildEmbeddedShopifyAdminRedirectUrl({
        accountId,
        returnTo: embeddedReturnTo,
        fallbackUrl: `${APP_URL}/flux?amazon=error&reason=server`,
        params: { amazon: 'error', reason: 'server' },
      }));
    }
    return res.redirect(buildDashboardRedirectUrl(stored.returnTo, { amazon: 'error', reason: 'server' }));
  }
});

// 5d. Init connexion — retourne l'URL à visiter pour lancer le flow OAuth
app.get('/api/v1/platforms/amazon/connect-init', authenticateJwtOrShopifySession, async (req, res) => {
  if (!AMAZON_APPLICATION_ID) {
    // État normal (Amazon SP-API pas encore activé côté infra), pas une
    // erreur serveur : 200 + flag configured:false. Évite que les clics
    // répétés du merchant ne polluent les alertes Cloud Monitoring 5xx.
    return res.status(200).json({ configured: false, message: 'Amazon OAuth non configuré' });
  }
  const embeddedSurface = String(req.query.surface || '').trim().toLowerCase() === 'embedded';
  const returnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(req.query.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(req.query.returnTo, '/flux');
  const code = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: code,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT,
      payload: {
        accountId: req.accountId,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo,
      },
      ttlMs: AMAZON_CONNECT_CODE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon connect-init code persistence error:', error);
    return res.status(503).json({ configured: true, message: 'Connexion Amazon temporairement indisponible' });
  }
  const baseUrl = req.protocol + '://' + req.get('host');
  const connectUrl = `${baseUrl}/api/v1/platforms/amazon/connect?code=${code}`;
  res.json({ connectUrl, configured: true });
});

// 5e. Point d'entrée pour lancer la connexion — ?code=xxx, set cookie, redirige vers Seller Central
app.get('/api/v1/platforms/amazon/connect', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=missing_code`);
  }

  let stored = null;
  try {
    stored = await consumeOAuthEphemeralState({
      id: String(code),
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_CONNECT,
    });
  } catch (error) {
    console.error('Amazon connect code lookup error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=code_lookup`);
  }
  if (!stored?.accountId) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=invalid_code`);
  }
  const accountId = stored.accountId;
  const embeddedSurface = stored.surface === 'embedded';
  const safeReturnTo = embeddedSurface
    ? normalizeEmbeddedReturnTo(stored.returnTo, '/embedded/channels')
    : normalizeDashboardReturnTo(stored.returnTo, '/flux');
  if (!AMAZON_APPLICATION_ID) {
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=not_configured`);
  }
  const state = crypto.randomUUID();
  try {
    await storeOAuthEphemeralState({
      id: state,
      provider: OAUTH_EPHEMERAL_PROVIDER_AMAZON,
      flow: OAUTH_EPHEMERAL_FLOW_AMAZON_STATE,
      payload: {
        accountId,
        surface: embeddedSurface ? 'embedded' : 'dashboard',
        returnTo: safeReturnTo,
      },
      ttlMs: AMAZON_STATE_TTL_MS,
    });
  } catch (error) {
    console.error('Amazon connect state persistence error:', error);
    return res.redirect(`${APP_URL}/flux?amazon=error&reason=state_persist`);
  }
  res.cookie('fp_amazon_connect_account', accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AMAZON_STATE_TTL_MS,
    path: '/'
  });
  const authUrl = `${AMAZON_SELLER_CENTRAL_BASE}/apps/authorize/consent?application_id=${encodeURIComponent(AMAZON_APPLICATION_ID)}&state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
});

// 5f. Connexion manuelle (refresh_token) — pour tests ou app privée
app.post('/api/v1/platforms/amazon/connect', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  const { refresh_token, seller_id } = req.body || {};
  if (!refresh_token) {
    return res.status(400).json({ message: 'refresh_token requis' });
  }
  if (!AMAZON_LWA_CLIENT_ID || !AMAZON_LWA_CLIENT_SECRET) {
    return res.status(503).json({ message: 'Amazon LWA non configuré (AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET)' });
  }
  try {
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: AMAZON_LWA_CLIENT_ID,
        client_secret: AMAZON_LWA_CLIENT_SECRET
      }).toString()
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return res.status(400).json({ message: 'Token invalide ou expiré. Vérifiez votre refresh_token.', error: tokens.error_description });
    }
    const expiry = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    if (prismaReady && prisma) {
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' LIMIT 1
      `, req.accountId);
      const connId = crypto.randomUUID();
      const meta = stringifyEncryptedJson({ sellerId: seller_id });
      if (existing && existing.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE "PlatformConnection" SET merchantid = COALESCE($1::text, merchantid), accesstoken = $2::text, refreshtoken = COALESCE($3::text, refreshtoken),
          tokenexpiry = $4::timestamptz, status = 'active', metadata = $5::jsonb, updatedat = NOW()
          WHERE accountid = $6::text AND platform = 'amazon'
        `, seller_id || null, encryptSecret(tokens.access_token), encryptSecret(refresh_token), expiry, meta, req.accountId);
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "PlatformConnection" (id, accountid, platform, merchantid, accesstoken, refreshtoken, tokenexpiry, status, metadata, createdat, updatedat)
          VALUES ($1::text, $2::text, 'amazon', $3::text, $4::text, $5::text, $6::timestamptz, 'active', $7::jsonb, NOW(), NOW())
        `, connId, req.accountId, seller_id || null, encryptSecret(tokens.access_token), encryptSecret(refresh_token), expiry, meta);
      }
    }
    res.json({ message: 'Amazon connecté', connected: true });
  } catch (e) {
    console.error('Amazon connect error:', e);
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/v1/platforms/amazon/status', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.json({ connected: false });
    }
    const connections = await prisma.$queryRawUnsafe(`
      SELECT * FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon' AND status = 'active'
    `, req.accountId);
    const conn = connections && connections[0];
    if (!conn) {
      return res.json({ connected: false });
    }
    const isExpired = conn.tokenexpiry && new Date(conn.tokenexpiry) < new Date();
    res.json({
      connected: conn.status === 'active',
      sellerId: conn.merchantid,
      tokenExpired: isExpired,
      connectedAt: conn.createdat
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

app.delete('/api/v1/platforms/amazon/disconnect', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (prismaReady && prisma) {
      await prisma.$executeRawUnsafe(`
        DELETE FROM "PlatformConnection" WHERE accountid = $1::text AND platform = 'amazon'
      `, req.accountId);
    }
    res.json({ message: 'Amazon déconnecté' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Push produits vers Amazon SP-API (Listings Items API)
app.post('/api/v1/platforms/amazon/push/:feedId', requireAuth, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { feedId } = req.params;
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!await verifyFeedAccess(feedId, req.accountId)) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
    const destinationContext = req.query.destinationId
      ? await getDestinationPushContext(req.accountId, String(req.query.destinationId), 'amazon')
      : null;
    const result = await executeAmazonPush({
      accountId: req.accountId,
      feedId,
      destinationContext,
      channelKey: req.query.channel || req.body?.channel || null,
    });
    res.json(result);
  } catch (error) {
    console.error('Amazon push error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      reconnect: error.reconnect === true || undefined,
    });
  }
});

// Push produits vers Google Merchant Center
app.post('/api/v1/platforms/gmc/push/:feedId', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { feedId } = req.params;
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    if (!await verifyFeedAccess(feedId, req.accountId)) {
      return res.status(403).json({ message: 'Accès refusé à ce flux' });
    }
    const destinationContext = req.query.destinationId
      ? await getDestinationPushContext(req.accountId, String(req.query.destinationId), 'gmc')
      : null;
    const result = await executeGmcPush({
      accountId: req.accountId,
      userId: req.user?.id || null,
      feedId,
      destinationContext,
    });
    res.json(result);
  } catch (error) {
    console.error('GMC push error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      reconnect: error.reconnect === true || undefined,
    });
  }
});

// Variante sans feedId : pousse le feed par défaut du compte. Utilisée par
// l'app Shopify embedded, qui ne connaît pas les ids de feeds (les routes
// /ingestion sont réservées au dashboard JWT).
app.post('/api/v1/platforms/gmc/push', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const feedId = await resolveDefaultFeedIdForAccount(req.accountId);
    if (!feedId) {
      return res.status(404).json({ message: 'Aucun flux produit trouvé pour ce compte.' });
    }
    const result = await executeGmcPush({
      accountId: req.accountId,
      userId: req.user?.id || null,
      feedId,
    });
    res.json(result);
  } catch (error) {
    console.error('GMC push (default feed) error:', error);
    res.status(error.statusCode || 500).json({
      message: error.message,
      reconnect: error.reconnect === true || undefined,
    });
  }
});

// Dernier push GMC du compte (pour afficher l'état de sync dans l'app embedded).
app.get('/api/v1/platforms/gmc/last-push', authenticateJwtOrShopifySession, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.json({ lastPush: null });
    }
    const rows = await prisma.$queryRawUnsafe(
      `
        SELECT status, totalproducts, succeeded, failed, errormessage, createdat
        FROM "ExportLog"
        WHERE accountid = $1::text AND platform = 'gmc'
        ORDER BY createdat DESC
        LIMIT 1
      `,
      req.accountId
    );
    const row = rows?.[0];
    res.json({
      lastPush: row
        ? {
            status: row.status,
            total: row.totalproducts,
            succeeded: row.succeeded,
            failed: row.failed,
            createdAt: row.createdat,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Historique des exports
app.get('/api/v1/platforms/export-logs', requireAuth, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) return res.json([]);
    
    const logs = await prisma.$queryRawUnsafe(`
      SELECT el.*, f.name as feedname 
      FROM "ExportLog" el 
      LEFT JOIN "Feed" f ON el.feedid = f.id
      WHERE el.accountid = $1::text
      ORDER BY el.createdat DESC LIMIT 20
    `, req.accountId);
    
    res.json(logs || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
}

module.exports = { registerPlatformsRoutes };
