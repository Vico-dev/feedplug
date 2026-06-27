/**
 * Routes du domaine "connectors" Shopify (6 routes) : probe du session token,
 * installation OAuth (install), connexion manuelle par token (connect), callback
 * OAuth (callback), réclamation post-install (claim) et vérification d'accès (verify).
 *
 * Extrait de server-minimal.js (même pattern que routes/ingestion.js et
 * routes/platforms.js) : corps de handlers copiés À L'IDENTIQUE. Seul ajout en tête
 * des handlers utilisant Prisma : `const prisma = getPrisma(); const prismaReady = getPrismaReady();`.
 * Ces routes étaient entrelacées avec les routes /api/v1/marketing/audits/.../connectors/*
 * (préfixes distincts, aucun chevauchement de chemin) ; elles sont regroupées ici dans
 * l'ordre source. Tous les symboles du scope de run() sont injectés via `deps` ;
 * leurs définitions RESTENT dans server-minimal.js. AUCUN changement de comportement.
 */
function registerConnectorsRoutes(app, {
  getPrisma,
  getPrismaReady,
  APP_URL,
  OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
  OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_APPS,
  resolveShopifyApp,
  SHOPIFY_OAUTH_STATE_TTL_MS,
  authenticateToken,
  buildShopifyAdminGraphqlUrl,
  consumeOAuthEphemeralState,
  crypto,
  decryptObjectSecrets,
  normalizeShopifyShop,
  shopifyProvisioning,
  storeOAuthEphemeralState,
  stringifyEncryptedJson,
  verifyShopifyInstallHmac,
  verifyShopifySessionToken,
}) {
app.post('/api/v1/shopify/session-token/probe', async (req, res) => {
  try {
    const authHeader = String(req.headers['authorization'] || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || String(req.headers['x-shopify-session-token'] || '').trim();

    if (!token) {
      return res.status(401).json({ message: 'Shopify session token requis' });
    }

    const { payload, shop } = verifyShopifySessionToken(token);
    return res.json({
      ok: true,
      shop,
      sub: payload.sub || null,
      dest: payload.dest || null,
    });
  } catch (error) {
    console.warn('Shopify session token probe failed:', error?.message || error);
    return res.status(401).json({ message: 'Shopify session token invalide' });
  }
});

// GET /install : point d'entrée pour le lien d'installation généré par Partners (Custom distribution).
// Reçoit shop, timestamp, hmac ; vérifie HMAC puis redirige vers l'écran d'autorisation.
app.get('/api/v1/connectors/shopify/install', async (req, res) => {
  try {
    const { shop, timestamp, hmac } = req.query;
    // /install = lien Partners de l'app listée (App Store) → app `listed`.
    const shopifyApp = SHOPIFY_APPS.listed;
    if (!shopifyApp.apiKey || !shopifyApp.apiSecret) {
      return res.status(500).send('Clés Shopify non configurées');
    }
    if (!shop || !hmac) {
      return res.status(400).send('Paramètres shop et hmac requis');
    }
    if (!verifyShopifyInstallHmac(req.query || {}, shopifyApp.apiSecret)) {
      return res.status(400).send('Signature HMAC invalide');
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).send('Nom de boutique Shopify invalide');
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
          locale: ['fr', 'en', 'es'].includes(String(req.query?.locale || ''))
            ? String(req.query.locale)
            : 'fr',
        },
        ttlMs: SHOPIFY_OAUTH_STATE_TTL_MS,
      });
    } catch (error) {
      console.error('Shopify install state persistence error:', error);
      return res.status(503).send('Connexion Shopify temporairement indisponible');
    }
    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      shopifyApp.apiKey
    )}&scope=${encodeURIComponent(shopifyApp.scopes)}&redirect_uri=${encodeURIComponent(
      shopifyApp.callbackUrl
    )}&state=${encodeURIComponent(state)}&grant_options[]=`;
    res.redirect(302, authUrl);
  } catch (err) {
    console.error('Shopify install error:', err);
    res.status(500).send('Erreur installation Shopify');
  }
});

// Init OAuth: redirige vers l'écran d'autorisation Shopify
app.post('/api/v1/connectors/shopify/connect', authenticateToken, async (req, res) => {
  try {
    const { shop, locale, host } = req.body || {};
    // /connect = marchand authentifié venu de feedplug.com → app `connector`.
    const shopifyApp = resolveShopifyApp('connector');
    if (!SHOPIFY_APPS.connector) {
      return res.status(503).json({ message: 'Connecteur Shopify non configuré' });
    }
    if (!shopifyApp.apiKey || !shopifyApp.apiSecret) {
      return res.status(500).json({ message: 'Clés Shopify non configurées côté serveur' });
    }
    if (!shop) {
      return res.status(400).json({ message: 'Paramètre shop requis' });
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }
    const state = crypto.randomUUID();

    // Stocker l'accountId pour l'associer au callback
    try {
      await storeOAuthEphemeralState({
        id: state,
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
        payload: {
          accountId: req.user.accountId,
          userId: req.user.id,
          shop: normalizedShop,
          appId: shopifyApp.appId,
          locale: ['fr', 'en', 'es'].includes(String(locale)) ? String(locale) : 'fr',
          host: typeof host === 'string' ? host.trim() : '',
        },
        ttlMs: SHOPIFY_OAUTH_STATE_TTL_MS,
      });
    } catch (error) {
      console.error('Shopify connect state persistence error:', error);
      return res.status(503).json({ message: 'Connexion Shopify temporairement indisponible' });
    }

    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      shopifyApp.apiKey
    )}&scope=${encodeURIComponent(shopifyApp.scopes)}&redirect_uri=${encodeURIComponent(
      shopifyApp.callbackUrl
    )}&state=${encodeURIComponent(state)}&grant_options[]=`;

    res.json({ url: authUrl });
  } catch (err) {
    console.error('Shopify connect error:', err);
    res.status(500).json({ message: 'Erreur lors de l\'init OAuth Shopify' });
  }
});

app.get('/api/v1/connectors/shopify/callback', async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { shop, code, state } = req.query;
    if (!shop || !code || !state) {
      return res.status(400).send('Requête invalide (shop/code/state manquant)');
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).send('Nom de boutique Shopify invalide');
    }

    // Le callback est partagé par les deux apps. On consomme d'abord le state
    // (UUID non devinable, usage unique) pour résoudre l'app, PUIS on vérifie le
    // HMAC avec le secret de cette app. Sans appId (states legacy) → `listed`.
    // Compromis assumé : une requête portant un state valide mais un HMAC
    // invalide « brûle » le state avant le rejet HMAC. Acceptable car le state
    // est un UUID v4 non devinable (pas de DoS exploitable à distance) ; au pire
    // le marchand relance l'install. L'alternative (HMAC d'abord) imposerait de
    // connaître l'app AVANT le state — impossible sur un callback mutualisé.
    let oauthContext = null;
    try {
      oauthContext = await consumeOAuthEphemeralState({
        id: String(state),
        provider: OAUTH_EPHEMERAL_PROVIDER_SHOPIFY,
        flow: OAUTH_EPHEMERAL_FLOW_SHOPIFY_STATE,
      });
    } catch (error) {
      console.error('Shopify callback state lookup error:', error);
      return res.status(503).send('Connexion Shopify temporairement indisponible');
    }
    if (!oauthContext?.shop || String(oauthContext.shop).toLowerCase() !== normalizedShop.toLowerCase()) {
      return res.status(400).send('State OAuth Shopify invalide ou expiré');
    }

    const shopifyApp = resolveShopifyApp(oauthContext.appId);
    if (!shopifyApp.apiKey || !shopifyApp.apiSecret) {
      return res.status(500).send('Clés Shopify non configurées');
    }
    if (!verifyShopifyInstallHmac(req.query || {}, shopifyApp.apiSecret)) {
      return res.status(400).send('Signature HMAC Shopify invalide');
    }

    const tokenUrl = `https://${normalizedShop}/admin/oauth/access_token`;
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: shopifyApp.apiKey,
        client_secret: shopifyApp.apiSecret,
        code,
      }),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      console.error('Shopify token exchange failed:', tokenResp.status, text);
      return res.status(502).send('Échec échange de token Shopify');
    }
    const tokenJson = await tokenResp.json();
    // tokenJson: { access_token, scope }

    // Stocker le token en base de données
    const isGuestInstall = oauthContext && oauthContext.guest === true;
    if (prismaReady && prisma && (oauthContext || isGuestInstall)) {
      try {
        const credId = crypto.randomUUID();
        const now = new Date().toISOString();
        const secretData = stringifyEncryptedJson({
          accessToken: tokenJson.access_token,
          scope: tokenJson.scope,
          shop: normalizedShop,
          appId: shopifyApp.appId,
        });

        await prisma.$executeRawUnsafe(`
          INSERT INTO "Credential" (id, name, connector, secretjson, createdat, updatedat)
          VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, $4::timestamptz, $4::timestamptz)
          ON CONFLICT (id) DO UPDATE SET secretjson = $3::jsonb, updatedat = $4::timestamptz
        `, credId, `Shopify - ${normalizedShop}`, secretData, now);

        if (!isGuestInstall && oauthContext && oauthContext.accountId) {
          // Flux Connect depuis FeedPlug : créer la source et le feed liés au compte
          const sourceId = crypto.randomUUID();
          const feedId = crypto.randomUUID();
          const sourceName = 'Shopify - ' + normalizedShop;
          const configData = JSON.stringify({ shop: normalizedShop });
          const mappingData = JSON.stringify({
            id: 'id',
            title: 'title',
            link: 'handle',
          });
          await prisma.$executeRawUnsafe(`
            INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
            VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
          `, sourceId, sourceName, configData, credId, oauthContext.accountId, now);
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
            VALUES ($1::text, $2::text, $3::text, 'DAILY'::text, 'ACTIVE'::text, $4::jsonb, 'guid_or_url'::text, $5::timestamptz, $5::timestamptz, $6::text)
          `, feedId, 'Flux principal - ' + sourceName, sourceId, mappingData, now, oauthContext.accountId);
          console.log('✅ Shopify credential + source + feed créés pour ' + normalizedShop + ' (account: ' + oauthContext.accountId + ')');
        } else if (isGuestInstall && !oauthContext?.auditShareToken) {
          // Install depuis Shopify App Store : auto-provision un Account
          // FeedPlug pour que le merchant soit utilisable immédiatement
          // (requis pour Built for Shopify : pas d'étape de signup séparée).
          try {
            const provision = await shopifyProvisioning.provisionAccountFromShopify({
              prisma,
              shop: normalizedShop,
              accessToken: tokenJson.access_token,
              credentialId: credId,
              billingProvider: shopifyApp.billingProvider,
            });
            if (provision.provisioned) {
              console.log(`✅ Shopify auto-provisioning : Account ${provision.accountId} créé pour ${normalizedShop}`);
            } else if (provision.existing && provision.accountId) {
              console.log(`✅ Shopify auto-provisioning : Account ${provision.accountId} déjà existant pour ${normalizedShop} (${provision.reason})`);
            } else {
              console.log(`ℹ️ Shopify auto-provisioning skipped pour ${normalizedShop} : ${provision.reason}`);
            }
          } catch (provisionErr) {
            // On dégrade vers le flow guest classique : credential créé mais
            // pas de compte. Le merchant pourra claim manuellement.
            console.warn('⚠️ Shopify auto-provisioning échoué pour ' + normalizedShop + ':', provisionErr?.message || provisionErr);
          }
        } else {
          // Flux install via lien Partners (guest) AVEC audit ou autre contexte non-provisionnable
          console.log(`✅ Shopify credential créé pour ${normalizedShop} (en attente de liaison)`);
          if (oauthContext?.auditShareToken) {
            try {
              const audits = await prisma.$queryRawUnsafe(`SELECT * FROM marketing_audits WHERE sharetoken = $1::text LIMIT 1`, oauthContext.auditShareToken);
              if (audits?.length) {
                const audit = audits[0];
                const input = decryptObjectSecrets(typeof audit.inputjson === 'string' ? JSON.parse(audit.inputjson || '{}') : (audit.inputjson || {}));
                input.shopifyConnection = {
                  shop: normalizedShop,
                  credentialId: credId,
                  connectedAt: now,
                };
                await prisma.$executeRawUnsafe(`
                  UPDATE marketing_audits
                  SET shopurl = COALESCE($1::text, shopurl),
                      connectortype = 'SHOPIFY',
                      inputjson = $2::jsonb,
                      status = 'source_connected',
                      "updatedAt" = NOW()
                  WHERE sharetoken = $3::text
                `, `https://${normalizedShop}`, stringifyEncryptedJson(input), oauthContext.auditShareToken);
              }
            } catch (auditUpdateError) {
              console.warn('⚠️ Impossible de lier la connexion Shopify à l audit public:', auditUpdateError.message);
            }
          }
        }
      } catch (dbErr) {
        console.error('Erreur stockage credential Shopify:', dbErr.message);
      }
    } else if (!oauthContext && !isGuestInstall) {
      console.warn('⚠️ Token Shopify reçu mais pas pu stocker en DB (prisma non ready ou context manquant)');
    }

    const resolvedLocale = ['fr', 'en', 'es'].includes(String(oauthContext?.locale || ''))
      ? String(oauthContext.locale)
      : 'fr';
    const resolvedHost = typeof req.query?.host === 'string' && req.query.host.trim()
      ? req.query.host.trim()
      : (typeof oauthContext?.host === 'string' ? oauthContext.host.trim() : '');

    // Quand l'install vient de Shopify (App Store / lien Partners / app embedded),
    // on doit rediriger DANS Shopify Admin pour que l'app se charge dans l'iframe.
    // Une redirection vers APP_URL standalone casse l'expérience embedded et
    // déclenche un rejet "doesn't stay within the iframe" lors de la review BFS.
    //
    // Le flux audit-flux (audit public) garde un redirect direct vers APP_URL
    // car ce n'est pas un contexte embedded Shopify.
    const cameFromShopifyAdmin = isGuestInstall || Boolean(resolvedHost);
    const isAuditFlow = Boolean(oauthContext?.auditShareToken);

    let redirectUrl;
    // BRANCH A réservée aux apps embedded (listée). L'app connecteur
    // (embedded=false) ne renvoie jamais dans l'admin Shopify : un marchand venu
    // de feedplug.com doit revenir sur feedplug.com (BRANCH C).
    if (cameFromShopifyAdmin && !isAuditFlow && shopifyApp.embedded && shopifyApp.apiKey) {
      // Redirige vers l'URL canonique de l'app embedded dans Shopify Admin.
      // Format : https://{shop}/admin/apps/{api_key}
      // Shopify Admin charge alors notre iframe avec les bons paramètres host/embedded.
      const embeddedParams = new URLSearchParams({
        shopify: 'connected',
        shop: normalizedShop,
      });
      if (isGuestInstall) embeddedParams.set('guest', '1');
      redirectUrl = `https://${normalizedShop}/admin/apps/${encodeURIComponent(shopifyApp.apiKey)}?${embeddedParams.toString()}`;
    } else if (isAuditFlow) {
      redirectUrl = `${APP_URL}/${resolvedLocale}/audit-flux/${encodeURIComponent(oauthContext.auditShareToken)}?shopify=connected`;
    } else {
      // Install initié depuis feedplug.com (user déjà loggué, pas de contexte Shopify Admin) :
      // retour direct sur le dashboard FeedPlug.
      const redirectParams = new URLSearchParams({
        shopify: 'connected',
        shop: normalizedShop,
      });
      if (isGuestInstall) {
        redirectParams.set('guest', '1');
      }
      if (resolvedHost) {
        redirectParams.set('host', resolvedHost);
        redirectParams.set('embedded', '1');
      }
      redirectUrl = `${APP_URL}/${resolvedLocale}/sources?${redirectParams.toString()}`;
    }
    res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('Shopify callback error:', err);
    res.status(500).send('Erreur callback Shopify');
  }
});

app.post('/api/v1/connectors/shopify/claim', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    const { shop } = req.body;
    if (!shop || !prismaReady || !prisma) {
      return res.status(400).json({ message: 'Paramètre shop requis ou base indisponible' });
    }
    const normalizedShop = normalizeShopifyShop(shop);
    if (!normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }
    const accountId = req.user.accountId;
    const creds = await prisma.$queryRawUnsafe(`
      SELECT c.id FROM "Credential" c
      WHERE c.connector = 'SHOPIFY' AND c.secretjson->>'shop' = $1
      AND NOT EXISTS (SELECT 1 FROM "FeedSource" f WHERE f."credentialid" = c.id)
      LIMIT 1
    `, normalizedShop);
    if (!creds || creds.length === 0) {
      return res.status(404).json({ message: 'Aucune connexion Shopify en attente pour cette boutique' });
    }
    const credId = creds[0].id;
    const sourceId = crypto.randomUUID();
    const feedId = crypto.randomUUID();
    const sourceName = 'Shopify - ' + normalizedShop;
    const configData = JSON.stringify({ shop: normalizedShop });
    const mappingData = JSON.stringify({
      id: 'id',
      title: 'title',
      link: 'handle',
    });
    const now = new Date().toISOString();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "FeedSource" (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
      VALUES ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
    `, sourceId, sourceName, configData, credId, accountId, now);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Feed" (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
      VALUES ($1::text, $2::text, $3::text, 'DAILY'::text, 'ACTIVE'::text, $4::jsonb, 'guid_or_url'::text, $5::timestamptz, $5::timestamptz, $6::text)
    `, feedId, 'Flux principal - ' + sourceName, sourceId, mappingData, now, accountId);
    console.log(`✅ Shopify source liée pour ${normalizedShop} (account: ${accountId})`);
    res.json({ ok: true, shop: normalizedShop });
  } catch (err) {
    console.error('Shopify claim error:', err);
    res.status(500).json({ message: 'Erreur lors de la liaison' });
  }
});

app.get('/api/v1/connectors/shopify/verify', authenticateToken, async (req, res) => {
      const prisma = getPrisma(); const prismaReady = getPrismaReady();
  try {
    if (!prismaReady || !prisma) {
      return res.status(503).json({ message: 'Service indisponible' });
    }
    const requestedShop = typeof req.query?.shop === 'string' ? req.query.shop.trim() : '';
    const normalizedShop = requestedShop ? normalizeShopifyShop(requestedShop) : '';
    if (requestedShop && !normalizedShop) {
      return res.status(400).json({ message: 'Nom de boutique Shopify invalide' });
    }

    const rows = normalizedShop
      ? await prisma.$queryRawUnsafe(
          `
            SELECT c.secretjson
            FROM "Credential" c
            JOIN "FeedSource" s ON s.credentialid = c.id
            WHERE c.connector = 'SHOPIFY'::text
              AND s.accountid = $1::text
              AND c.secretjson->>'shop' = $2::text
            ORDER BY c.createdat DESC
            LIMIT 1
          `,
          req.user.accountId,
          normalizedShop
        )
      : await prisma.$queryRawUnsafe(
          `
            SELECT c.secretjson
            FROM "Credential" c
            JOIN "FeedSource" s ON s.credentialid = c.id
            WHERE c.connector = 'SHOPIFY'::text
              AND s.accountid = $1::text
            ORDER BY c.createdat DESC
            LIMIT 1
          `,
          req.user.accountId
        );

    if (!rows?.length) {
      return res.status(404).json({ message: 'Aucune boutique Shopify connectée pour ce compte' });
    }

    const secret = decryptObjectSecrets(
      typeof rows[0].secretjson === 'string' ? JSON.parse(rows[0].secretjson) : rows[0].secretjson
    );
    const accessToken = secret.accessToken || secret.access_token || '';
    const resolvedShop = normalizeShopifyShop(secret.shop || normalizedShop);
    if (!resolvedShop || !accessToken) {
      return res.status(409).json({ message: 'Connexion Shopify incomplète, reconnectez la boutique' });
    }

    const resp = await fetch(buildShopifyAdminGraphqlUrl(resolvedShop), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': String(accessToken),
      },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return res.status(resp.status).json({
        message: 'Erreur de verification Shopify',
        detail: json,
        shop: resolvedShop,
        apiVersion: SHOPIFY_ADMIN_API_VERSION,
      });
    }
    res.json({
      ok: true,
      shop: resolvedShop,
      apiVersion: SHOPIFY_ADMIN_API_VERSION,
      data: json.data || json,
    });
  } catch (err) {
    console.error('Shopify verify error:', err);
    res.status(500).json({ message: 'Erreur vérification Shopify' });
  }
});
}

module.exports = { registerConnectorsRoutes };
