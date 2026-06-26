/**
 * Routes d'enrichissement IA : optimisation titres/descriptions/images,
 * highlights, images lifestyle (GCS), proxy image, batch, scores qualité,
 * segments et filtrage d'items.
 *
 * Extrait de server-minimal.js (pattern routes/auth.js) : corps de routes
 * identiques (références prisma réécrites en getPrisma()/getPrismaReady()),
 * dépendances du scope de run() injectées via `deps`.
 */
const crypto = require('crypto');
const { mergeOptimizedContent } = require('../utils/platform-content');
const { optimizeTitleWithAI, optimizeTitlesBatch, calculateTitleScore } = require('../optimization/title-optimizer');
const { optimizeDescriptionWithAI, optimizeDescriptionsBatch, calculateDescriptionScore } = require('../optimization/description-optimizer');
const { generateHighlightsWithAI } = require('../optimization/highlights-generator');
const { optimizeImage, optimizeImagesBatch } = require('../optimization/image-optimizer');
const { generateLifestyleImage, downloadImageAsBase64, PRESET_SCENES } = require('../optimization/lifestyle-image-generator');
const { getAiUsage, AI_SOFT_CAP_MONTHLY } = require('../lib/ai-quota');
const { checkAiQuota, quotaMessage, getCap } = require('../lib/ai-caps');
const { getAccountPlan } = require('../lib/plan-limits');

function registerEnrichmentRoutes(app, {
  getPrisma,
  getPrismaReady,
  storage,
  bucketName,
  normalizePlatformKey,
  canUseFeature,
  trackAiUsage,
  verifyItemAccess,
  getDestinationPushContext,
  resolveItemId,
}) {
// Optimiser le titre d'un produit (optionnel: savePlatform = gmc|meta|amazon|chatgpt pour sauvegarder dans optimized[platform])
// Compteur de consommation IA du mois courant (soft cap — affichage front).
app.get('/api/v1/enrichment/ai-usage', async (req, res) => {
  try {
    const accountId = req.accountId;
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.json({
        text: { used: 0, cap: AI_SOFT_CAP_MONTHLY },
        image: { used: 0, cap: AI_SOFT_CAP_MONTHLY },
        used: 0, softCap: AI_SOFT_CAP_MONTHLY, percent: 0,
        period: null,
      });
    }
    // Compteurs séparés texte/images (A2) + caps DURS par plan (A3).
    const usage = await getAiUsage(getPrisma(), accountId);
    const plan = await getAccountPlan(getPrisma(), accountId);
    const textCap = getCap(plan, 'text');
    const imageCap = getCap(plan, 'image');
    usage.text.cap = textCap;
    usage.image.cap = imageCap;
    // Rétro-compat front (forme historique { used, softCap, percent } = total agrégé).
    const totalUsed = (usage.text.used || 0) + (usage.image.used || 0);
    res.json({
      ...usage,
      plan,
      used: totalUsed,
      softCap: AI_SOFT_CAP_MONTHLY,
      percent: Math.round((totalUsed / AI_SOFT_CAP_MONTHLY) * 100),
    });
  } catch (error) {
    console.error('Erreur ai-usage:', error);
    res.status(500).json({ message: 'Erreur' });
  }
});

app.post('/api/v1/enrichment/optimize-title', async (req, res) => {
  try {
    const { itemId, platform, industry, forceRefresh, savePlatform, saveDestinationId } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ message: 'itemId requis' });
    }
    
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const accountId = req.accountId;
    const addonIA = await canUseFeature(getPrisma(), accountId, 'addonIA');
    if (!addonIA.allowed) {
      return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
    }
    // A3 — hard cap texte : on bloque AVANT l'appel Gemini si le quota est dépassé.
    const quota = await checkAiQuota(getPrisma(), accountId, 'text', 1);
    if (!quota.allowed) {
      return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quota), used: quota.used, cap: quota.cap });
    }
    const resolvedId = await resolveItemId(getPrisma(), String(itemId), accountId);
    if (!resolvedId) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    if (!(await verifyItemAccess(resolvedId, accountId))) {
      return res.status(403).json({ message: 'Accès refusé à ce produit' });
    }

    const items = await getPrisma().$queryRawUnsafe(`SELECT * FROM "FeedItem" WHERE id = $1::text`, resolvedId);

    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const plat = platform || 'GMC';
    const targetDestinationContext = saveDestinationId
      ? await getDestinationPushContext(accountId, String(saveDestinationId), plat)
      : null;
    const result = await optimizeTitleWithAI(getPrisma(), items[0], {
      platform: plat,
      industry,
      forceRefresh: forceRefresh || false,
      destinationContext: targetDestinationContext,
    });
    
    if (savePlatform && result.optimizedTitle && (await verifyItemAccess(items[0].id, req.accountId))) {
      const platKey = String(savePlatform).toLowerCase().replace('google', 'gmc');
      if (['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        const destinationContext = targetDestinationContext && platKey === normalizePlatformKey(targetDestinationContext.platformKey)
          ? targetDestinationContext
          : saveDestinationId
            ? await getDestinationPushContext(accountId, String(saveDestinationId), platKey)
            : null;
        let cf = items[0].customfields;
        try { cf = typeof cf === 'string' ? JSON.parse(cf || '{}') : (cf || {}); } catch (e) { cf = {}; }
        const newCf = mergeOptimizedContent(cf, platKey, { title: result.optimizedTitle }, destinationContext ? {
          destinationId: destinationContext.id,
          marketCode: destinationContext.marketCode,
          localeCode: destinationContext.localeCode || null,
        } : {});
        await getPrisma().$executeRawUnsafe(`UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`, JSON.stringify(newCf), items[0].id);
      }
    }
    
    trackAiUsage(accountId, 1);
    res.json(result);
  } catch (error) {
    console.error('Erreur optimize-title:', error);
    res.status(500).json({ message: error.message });
  }
});

// Optimiser la description d'un produit (optionnel: savePlatform pour sauvegarder dans optimized[platform])
app.post('/api/v1/enrichment/optimize-description', async (req, res) => {
  try {
    const { itemId, platform, industry, forceRefresh, savePlatform, saveDestinationId } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ message: 'itemId requis' });
    }
    
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const accountId = req.accountId;
    // A3 — hard cap texte avant l'appel Gemini.
    const quotaDesc = await checkAiQuota(getPrisma(), accountId, 'text', 1);
    if (!quotaDesc.allowed) {
      return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quotaDesc), used: quotaDesc.used, cap: quotaDesc.cap });
    }
    const resolvedId = await resolveItemId(getPrisma(), String(itemId), accountId);
    if (!resolvedId) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    if (!(await verifyItemAccess(resolvedId, accountId))) {
      return res.status(403).json({ message: 'Accès refusé à ce produit' });
    }

    const items = await getPrisma().$queryRawUnsafe(`SELECT * FROM "FeedItem" WHERE id = $1::text`, resolvedId);

    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    const plat = platform || 'GMC';
    const targetDestinationContext = saveDestinationId
      ? await getDestinationPushContext(accountId, String(saveDestinationId), plat)
      : null;
    const result = await optimizeDescriptionWithAI(getPrisma(), items[0], {
      platform: plat,
      industry,
      forceRefresh: forceRefresh || false,
      destinationContext: targetDestinationContext,
    });
    
    if (savePlatform && result.optimizedDescription && (await verifyItemAccess(items[0].id, req.accountId))) {
      const platKey = String(savePlatform).toLowerCase().replace('google', 'gmc');
      if (['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        const destinationContext = targetDestinationContext && platKey === normalizePlatformKey(targetDestinationContext.platformKey)
          ? targetDestinationContext
          : saveDestinationId
            ? await getDestinationPushContext(accountId, String(saveDestinationId), platKey)
            : null;
        let cf = items[0].customfields;
        try { cf = typeof cf === 'string' ? JSON.parse(cf || '{}') : (cf || {}); } catch (e) { cf = {}; }
        const newCf = mergeOptimizedContent(cf, platKey, { description: result.optimizedDescription }, destinationContext ? {
          destinationId: destinationContext.id,
          marketCode: destinationContext.marketCode,
          localeCode: destinationContext.localeCode || null,
        } : {});
        await getPrisma().$executeRawUnsafe(`UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`, JSON.stringify(newCf), items[0].id);
      }
    }
    
    trackAiUsage(accountId, 1);
    res.json(result);
  } catch (error) {
    console.error('Erreur optimize-description:', error);
    res.status(500).json({ message: error.message });
  }
});

// Générer des highlights (bullet points) pour un produit avec IA
app.post('/api/v1/enrichment/generate-highlights', async (req, res) => {
  try {
    const { itemId, platform, industry, forceRefresh, savePlatform, saveDestinationId } = req.body;

    if (!itemId) {
      return res.status(400).json({ message: 'itemId requis' });
    }

    const accountId = req.accountId;
    if (getPrismaReady?.() && getPrisma()) {
      const addonIA = await canUseFeature(getPrisma(), accountId, 'addonIA');
      if (!addonIA.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
      }
    }

    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Prisma non disponible' });
    }

    // A3 — hard cap texte avant l'appel Gemini.
    const quotaHl = await checkAiQuota(getPrisma(), accountId, 'text', 1);
    if (!quotaHl.allowed) {
      return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quotaHl), used: quotaHl.used, cap: quotaHl.cap });
    }

    const resolvedId = await resolveItemId(getPrisma(), String(itemId), accountId);
    if (!resolvedId) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    if (!(await verifyItemAccess(resolvedId, accountId))) {
      return res.status(403).json({ message: 'Accès refusé à ce produit' });
    }

    const items = await getPrisma().$queryRawUnsafe(`
      SELECT id, title, descriptiontext AS "descriptionText", descriptionhtml AS "descriptionHtml",
             imageurl AS "imageUrl", brand, sku, price, currency, gtin, mpn, condition, inventory, customfields
      FROM "FeedItem" WHERE id = $1::text LIMIT 1
    `, resolvedId);

    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const item = items[0];
    let cf;
    try { cf = typeof item.customfields === 'string' ? JSON.parse(item.customfields || '{}') : (item.customfields || {}); } catch (e) { cf = {}; }
    const product = { ...item, customfields: cf };

    const plat = platform ? String(platform).toUpperCase() : 'GMC';
    const targetDestinationContext = saveDestinationId
      ? await getDestinationPushContext(accountId, String(saveDestinationId), plat)
      : null;
    const result = await generateHighlightsWithAI(getPrisma(), product, {
      platform: plat,
      industry,
      forceRefresh: forceRefresh || false,
      destinationContext: targetDestinationContext,
    });

    // Sauvegarder si demandé
    if (savePlatform && result.highlights && result.highlights.length > 0) {
      const platKey = String(savePlatform).toLowerCase().replace('google', 'gmc');
      if (['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) {
        const destinationContext = targetDestinationContext && platKey === normalizePlatformKey(targetDestinationContext.platformKey)
          ? targetDestinationContext
          : saveDestinationId
            ? await getDestinationPushContext(accountId, String(saveDestinationId), platKey)
            : null;
        const newCf = mergeOptimizedContent(cf, platKey, { highlights: result.highlights }, destinationContext ? {
          destinationId: destinationContext.id,
          marketCode: destinationContext.marketCode,
          localeCode: destinationContext.localeCode || null,
        } : {});
        await getPrisma().$executeRawUnsafe(`UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`, JSON.stringify(newCf), item.id);
      }
    }

    trackAiUsage(accountId, 1);
    res.json(result);
  } catch (error) {
    console.error('Erreur generate-highlights:', error);
    res.status(500).json({ message: error.message });
  }
});

// Optimiser l'image d'un produit
app.post('/api/v1/enrichment/optimize-image', async (req, res) => {
  try {
    const { imageUrl, platform, quality, format } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'imageUrl requis' });
    }
    const accountId = req.accountId;
    if (getPrismaReady?.() && getPrisma()) {
      const addonIA = await canUseFeature(getPrisma(), accountId, 'addonIA');
      if (!addonIA.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
      }
    }
    
    const result = await optimizeImage(imageUrl, { platform: platform || 'GMC', quality: quality || 85, format: format || 'webp' });
    res.json(result);
  } catch (error) {
    console.error('Erreur optimize-image:', error);
    res.status(500).json({ message: error.message });
  }
});

// Générer une image "mise en situation" (lifestyle) à partir de l'image produit (Fal Bria Product Shot ou Vertex)
// Accepte imageUrl, ou imageBase64 + imageMimeType. Si feedItemId fourni : l'image envoyée est sauvegardée en GCS
// et réutilisée automatiquement pour ce produit (plus besoin de ré-uploader).
app.post('/api/v1/enrichment/generate-lifestyle-image', async (req, res) => {
  try {
    const {
      imageUrl,
      imageBase64,
      imageMimeType,
      sceneDescription,
      scenePreset,
      customScene,
      mannequinProfile,
      feedItemId,
      productPageUrl,
      productTitle,
      productBrand,
      productDescription,
      provider: bodyProvider,
      model: bodyModel
    } = req.body;
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ message: 'imageUrl ou imageBase64 requis' });
    }
    const accountId = req.accountId;
    if (getPrismaReady?.() && getPrisma()) {
      const addonIA = await canUseFeature(getPrisma(), accountId, 'addonIA');
      if (!addonIA.allowed) {
        return res.status(403).json({ code: 'PLAN_FEATURE', message: addonIA.message });
      }
      // A3 — hard cap IMAGES avant la génération (Vertex/Imagen/Fal payants).
      const quotaImg = await checkAiQuota(getPrisma(), accountId, 'image', 1);
      if (!quotaImg.allowed) {
        return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quotaImg), used: quotaImg.used, cap: quotaImg.cap });
      }
    }
    const baseSceneDescription = sceneDescription || (scenePreset && PRESET_SCENES[scenePreset]) || PRESET_SCENES.living_room;
    const customSceneText = typeof customScene === 'string' ? customScene.trim() : '';
    const mannequinValue = typeof mannequinProfile === 'string' ? mannequinProfile.trim().toLowerCase() : 'none';
    const mannequinPrompt = mannequinValue === 'woman'
      ? 'Include a realistic adult female mannequin or model when relevant to present the product naturally. Keep the product as the hero and avoid extra accessories.'
      : mannequinValue === 'man'
        ? 'Include a realistic adult male mannequin or model when relevant to present the product naturally. Keep the product as the hero and avoid extra accessories.'
        : mannequinValue === 'child'
          ? 'Include a realistic child mannequin or child model when relevant to present the product naturally. Keep the product as the hero and avoid extra accessories.'
          : '';
    const description = [
      baseSceneDescription,
      customSceneText ? `Specific business context to follow: ${customSceneText}.` : '',
      mannequinPrompt,
    ]
      .filter(Boolean)
      .join(' ');
    const productContext = [productTitle, productBrand].filter(Boolean).join(' — ') || null;
    const productDescShort = productDescription && String(productDescription).trim().slice(0, 500) || null;

    let refererOrigin = null;
    if (productPageUrl && typeof productPageUrl === 'string') {
      try {
        refererOrigin = new URL(productPageUrl.trim()).origin;
      } catch (_) {}
    }

    let imageUrlToUse = imageUrl || null;
    let options = imageBase64 ? { imageBase64, imageMimeType: imageMimeType || 'image/jpeg' } : {};
    if (refererOrigin) options.refererOrigin = refererOrigin;
    if (productContext) options.productContext = productContext;
    if (productDescShort) options.productDescription = productDescShort;
    if (bodyProvider && ['vertex', 'fal'].includes(String(bodyProvider).toLowerCase())) options.provider = String(bodyProvider).toLowerCase();
    if (bodyModel && typeof bodyModel === 'string' && bodyModel.trim()) options.model = bodyModel.trim();
    // A4 — cache de génération d'images : on passe prisma + composants de clé.
    if (getPrismaReady?.() && getPrisma()) options.prisma = getPrisma();
    options.accountId = accountId;
    options.mannequin = mannequinValue;
    if (req.body.ratio && typeof req.body.ratio === 'string') options.ratio = req.body.ratio.trim();

    let effectiveItemId = null;
    if (feedItemId && getPrismaReady?.() && getPrisma()) {
      effectiveItemId = (await resolveItemId(getPrisma(), String(feedItemId), accountId)) || feedItemId;
    }
    if (effectiveItemId && getPrismaReady?.() && getPrisma()) {
      const hasAccess = await verifyItemAccess(effectiveItemId, accountId);
      if (hasAccess) {
        const catalogPrefix = `catalog/${accountId}/${effectiveItemId}`;
        const bucket = storage.bucket(bucketName);

        if (imageBase64) {
          const ext = (imageMimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
          const path = `${catalogPrefix}/product.${ext}`;
          const file = bucket.file(path);
          const buffer = Buffer.from(imageBase64, 'base64');
          await file.save(buffer, {
            metadata: { contentType: imageMimeType || 'image/jpeg' },
            resumable: false,
          });
          imageUrlToUse = null;
          options = { imageBase64, imageMimeType: imageMimeType || 'image/jpeg' };
        } else {
          const [jpgExists] = await bucket.file(`${catalogPrefix}/product.jpg`).exists().catch(() => [false]);
          const [pngExists] = await bucket.file(`${catalogPrefix}/product.png`).exists().catch(() => [false]);
          if (jpgExists) {
            const file = bucket.file(`${catalogPrefix}/product.jpg`);
            const [buf] = await file.download();
            options = { imageBase64: buf.toString('base64'), imageMimeType: 'image/jpeg' };
            imageUrlToUse = null;
          } else if (pngExists) {
            const file = bucket.file(`${catalogPrefix}/product.png`);
            const [buf] = await file.download();
            options = { imageBase64: buf.toString('base64'), imageMimeType: 'image/png' };
            imageUrlToUse = null;
          }
          // si ni jpg ni png : imageUrlToUse reste l’URL produit (peut donner 403 si le marchand bloque)
        }
      }
      // Si hasAccess est false, on ignore feedItemId et on continue avec imageUrl/imageBase64 (pas de 403)
    }

    // Si on a encore une URL produit (pas de base64) : la résoudre avec plusieurs stratégies pour contourner 403 / CDN
    if (imageUrlToUse && !options.imageBase64) {
      let resolved = null;
      const productOrigin = refererOrigin || null;
      let imageOrigin = null;
      try {
        imageOrigin = new URL(imageUrlToUse).origin;
      } catch (_) {}
      const strategies = [];
      if (productOrigin) strategies.push({ refererOrigin: productOrigin });
      if (imageOrigin && imageOrigin !== productOrigin) strategies.push({ refererOrigin: imageOrigin });
      strategies.push({ refererOrigin: null });
      for (const s of strategies) {
        try {
          resolved = await downloadImageAsBase64(imageUrlToUse, s);
          break;
        } catch (err) {
          console.warn('Lifestyle: téléchargement image produit échoué (stratégie referer):', err.message);
        }
      }
      if (resolved) {
        options.imageBase64 = resolved.base64;
        options.imageMimeType = resolved.mimeType || 'image/jpeg';
        imageUrlToUse = null;
        if (effectiveItemId && getPrismaReady?.() && getPrisma()) {
          const hasAccess = await verifyItemAccess(effectiveItemId, accountId);
          if (hasAccess) {
            const catalogPrefix = `catalog/${accountId}/${effectiveItemId}`;
            const ext = (resolved.mimeType || '').includes('png') ? 'png' : 'jpg';
            const path = `${catalogPrefix}/product.${ext}`;
            try {
              await storage.bucket(bucketName).file(path).save(Buffer.from(resolved.base64, 'base64'), {
                metadata: { contentType: resolved.mimeType || 'image/jpeg' },
                resumable: false,
              });
            } catch (saveErr) {
              console.warn('Lifestyle: sauvegarde image catalogue ignorée:', saveErr.message);
            }
          }
        }
      } else {
        return res.status(403).json({
          message: 'Image produit inaccessible (blocage par le site marchand). Utilisez « Envoyer une image » pour téléverser l\'image produit, elle sera enregistrée pour ce produit.',
        });
      }
    }

    // Timeout 180s : la génération Vertex (image in → image out) peut être très lente
    const LIFESTYLE_TIMEOUT_MS = 180000;
    const result = await Promise.race([
      generateLifestyleImage(imageUrlToUse, description, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Génération trop longue (timeout). Réessayez.')), LIFESTYLE_TIMEOUT_MS)
      ),
    ]);
    // URL signée pour que le navigateur puisse afficher l'image (bucket souvent privé). Ne jamais renvoyer l'URL brute.
    let urlToReturn = result.url;
    if (result.url && result.url.startsWith(`https://storage.googleapis.com/${bucketName}/`)) {
      const path = result.url.replace(`https://storage.googleapis.com/${bucketName}/`, '');
      const file = storage.bucket(bucketName).file(path);
      try {
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 2 * 60 * 60 * 1000, // 2 h
        });
        urlToReturn = signedUrl;
      } catch (signErr) {
        console.error('Signed URL lifestyle image:', signErr.message);
        return res.status(500).json({ message: 'Image générée mais impossible de créer l\'URL de prévisualisation. Vérifiez la config GCS (compte de service, permissions).' });
      }
    }
    // A4 — on ne compte la consommation IA que si l'image a réellement été
    // générée (un hit cache renvoie result.cached === true, aucun appel payant).
    if (!result.cached) trackAiUsage(accountId, 1, 'image');
    res.json({ url: urlToReturn, contentType: result.contentType });
  } catch (error) {
    console.error('Erreur generate-lifestyle-image:', error);
    const status = error.status || error.statusCode;
    const isTimeout = error.message && String(error.message).includes('timeout');
    const msg = error.message || 'Génération impossible';
    const is422 = status === 422 || (typeof msg === 'string' && (msg.includes('Unprocessable') || msg.includes('422')));
    const is403 = status === 403 || (typeof msg === 'string' && (msg.includes('403') || msg.includes('Image inaccessible')));
    const userMessage = isTimeout
      ? 'La génération a pris trop de temps. Réessayez.'
      : is403
        ? "Image inaccessible (403). Envoyez une image une fois : elle sera enregistrée pour ce produit et réutilisée automatiquement."
        : is422
          ? "L'image produit n'a pas pu être utilisée. Vérifiez que l'URL est accessible ou envoyez une image."
          : msg;
    const httpStatus = isTimeout ? 504 : is403 ? 403 : (status && status >= 400 && status < 600 ? status : 500);
    res.status(httpStatus).json({ message: userMessage });
  }
});

// Obtenir une URL signée pour une image lifestyle (pour « Copier l'URL » : lien valide même si l'ancienne URL a expiré).
app.post('/api/v1/enrichment/sign-lifestyle-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url requis' });
    }
    const base = `https://storage.googleapis.com/${bucketName}/`;
    const urlWithoutQuery = url.split('?')[0];
    if (!urlWithoutQuery.startsWith(base)) {
      return res.status(400).json({ message: 'URL non autorisée (bucket différent)' });
    }
    const path = urlWithoutQuery.replace(base, '').replace(/^\//, '');
    if (!path.startsWith('lifestyle/')) {
      return res.status(400).json({ message: 'Seules les images lifestyle sont autorisées' });
    }
    const file = storage.bucket(bucketName).file(path);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 2 * 60 * 60 * 1000, // 2 h
    });
    res.json({ url: signedUrl });
  } catch (e) {
    console.error('Erreur sign-lifestyle-url:', e.message);
    res.status(500).json({ message: 'Impossible de générer l\'URL. Vérifiez que le fichier existe.' });
  }
});

// Proxy image : récupère une image produit (avec Referer anti-403) et renvoie une URL signée GCS.
// Utilisable partout (front, flux, lifestyle) pour contourner les CDN qui bloquent les requêtes sans Referer.
app.post('/api/v1/enrichment/proxy-image', async (req, res) => {
  try {
    const { imageUrl, productPageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ message: 'imageUrl requis' });
    }
    const accountId = req.accountId;
    let refererOrigin = null;
    if (productPageUrl && typeof productPageUrl === 'string') {
      try {
        refererOrigin = new URL(productPageUrl.trim()).origin;
      } catch (_) {}
    }
    const { base64, mimeType } = await downloadImageAsBase64(imageUrl, { refererOrigin });
    const ext = mimeType && mimeType.includes('png') ? 'png' : 'jpg';
    const hash = crypto.createHash('sha256').update(imageUrl + (refererOrigin || '')).digest('hex').slice(0, 16);
    const path = `proxy/${accountId}/${hash}.${ext}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(path);
    const buffer = Buffer.from(base64, 'base64');
    await file.save(buffer, {
      metadata: { contentType: mimeType || 'image/jpeg' },
      resumable: false,
    });
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 h
    });
    res.json({ url: signedUrl, contentType: mimeType || 'image/jpeg' });
  } catch (error) {
    console.error('Erreur proxy-image:', error.message);
    const msg = error.message || 'Impossible de récupérer l\'image';
    const status = msg.includes('403') || msg.includes('Image inaccessible') ? 403 : 500;
    res.status(status).json({ message: msg });
  }
});

// Optimiser plusieurs produits en batch (support multi-plateforme : platforms = ['gmc','meta','amazon','chatgpt'])
// saveToCatalog: false = ne pas écrire en base (pour tests A/B : on ne garde que les résultats)
app.post('/api/v1/enrichment/batch', async (req, res) => {
  try {
    const { itemIds, optimizations, platform, platforms, saveToCatalog = true, saveDestinationId } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: 'itemIds requis (array)' });
    }
    
    if (itemIds.length > 1000) {
      return res.status(400).json({ message: 'Maximum 1000 produits par batch' });
    }
    
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const rawPlatform = platform ? String(platform) : 'GMC';
    const rawPlatforms = Array.isArray(platforms) && platforms.length > 0
      ? platforms
      : [rawPlatform];
    const normalizedPlatforms = rawPlatforms.map(p => {
      const s = String(p).toUpperCase().replace(/GOOGLE/, 'GMC');
      return s || 'GMC';
    });
    
    const placeholders = itemIds.map((_, i) => `$${i + 1}::text`).join(',');
    const acctParam = `$${itemIds.length + 1}::text`;
    const products = await getPrisma().$queryRawUnsafe(
      `SELECT i.* FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id WHERE i.id IN (${placeholders}) AND f.accountid = ${acctParam}`,
      ...itemIds, req.accountId
    );
    
    const accountId = req.accountId;

    // A3 — hard cap texte AVANT les appels Gemini du batch. On ne tronque pas
    // silencieusement : si la demande dépasse le quota restant, on refuse tout
    // le batch avec un message explicite indiquant le restant.
    const textPerProduct = (optimizations?.titles ? 1 : 0) + (optimizations?.descriptions ? 1 : 0);
    const requestedTextOps = products.length * Math.max(1, normalizedPlatforms.length) * Math.max(0, textPerProduct);
    if (requestedTextOps > 0) {
      const quotaBatch = await checkAiQuota(getPrisma(), accountId, 'text', requestedTextOps);
      if (!quotaBatch.allowed) {
        return res.status(429).json({ code: 'AI_QUOTA', message: quotaMessage(quotaBatch), used: quotaBatch.used, cap: quotaBatch.cap, remaining: quotaBatch.remaining, requested: requestedTextOps });
      }
    }

    const results = { total: itemIds.length, found: products.length, titles: null, descriptions: null, images: null, totalCost: 0 };

    const platformResults = {};
    for (const plat of normalizedPlatforms) {
      platformResults[plat] = { titles: null, descriptions: null };
    }

    const shouldWriteLegacyOptimizedFields = !String(saveDestinationId || '').trim();
    const destinationContextByPlatform = {};
    if (!shouldWriteLegacyOptimizedFields) {
      for (const plat of normalizedPlatforms) {
        const platKey = (plat === 'GMC' ? 'gmc' : plat.toLowerCase());
        if (!['gmc', 'meta', 'amazon', 'chatgpt'].includes(platKey)) continue;
        destinationContextByPlatform[platKey] = await getDestinationPushContext(accountId, String(saveDestinationId), platKey);
      }
    }
    
    for (const plat of normalizedPlatforms) {
      const platKey = (plat === 'GMC' ? 'gmc' : plat.toLowerCase());
      const destinationContext = destinationContextByPlatform[platKey] || null;
      if (optimizations?.titles) {
        const titleResults = await optimizeTitlesBatch(getPrisma(), products, { platform: plat, destinationContext });
        platformResults[plat].titles = titleResults;
        results.totalCost += titleResults.totalCost;
      }
      if (optimizations?.descriptions) {
        const descResults = await optimizeDescriptionsBatch(getPrisma(), products, { platform: plat, destinationContext });
        platformResults[plat].descriptions = descResults;
        results.totalCost += descResults.totalCost;
      }
    }
    
    if (optimizations?.images) {
      const imageProducts = products.filter(p => p.imageurl || p.imageUrl);
      const imageUrls = imageProducts.map(p => p.imageurl || p.imageUrl);
      if (imageUrls.length > 0) {
        const imageResults = await optimizeImagesBatch(imageUrls, { platform: normalizedPlatforms[0] || 'GMC' });
        imageResults.results.forEach((r, i) => {
          r.productId = imageProducts[i]?.id;
          r.optimizedImageUrl = r.optimized?.main?.url || r.optimized?.url;
        });
        results.images = imageResults;
      }
    }
    
    results.titles = platformResults[normalizedPlatforms[0]]?.titles || null;
    results.descriptions = platformResults[normalizedPlatforms[0]]?.descriptions || null;
    
    const savedCount = { titles: 0, descriptions: 0 };
    if (!saveToCatalog) {
      results.saved = savedCount;
      return res.json(results);
    }

    for (const product of products) {
      try {
        let currentCf = product.customfields;
        try {
          currentCf = typeof currentCf === 'string' ? JSON.parse(currentCf || '{}') : (currentCf || {});
        } catch (e) {
          currentCf = {};
        }
        
        let nextCf = currentCf;
        let hasContentUpdates = false;
        const legacyUpdates = {};
        let firstTitle = null;
        let firstDesc = null;
        
        for (const plat of normalizedPlatforms) {
          const platKey = (plat === 'GMC' ? 'gmc' : plat.toLowerCase());
          const platContent = {};
          
          if (optimizations?.titles && platformResults[plat]?.titles?.results) {
            const tr = platformResults[plat].titles.results.find(r => r.productId === product.id && r.success);
            if (tr?.optimizedTitle) {
              platContent.title = tr.optimizedTitle;
              if (!firstTitle) firstTitle = tr.optimizedTitle;
            }
          }
          if (optimizations?.descriptions && platformResults[plat]?.descriptions?.results) {
            const dr = platformResults[plat].descriptions.results.find(r => r.productId === product.id && r.success);
            if (dr?.optimizedDescription) {
              platContent.description = dr.optimizedDescription;
              if (!firstDesc) firstDesc = dr.optimizedDescription;
            }
          }
          if (Object.keys(platContent).length > 0) {
            const destinationContext = destinationContextByPlatform[platKey];
            nextCf = mergeOptimizedContent(nextCf, platKey, platContent, destinationContext ? {
              destinationId: destinationContext.id,
              marketCode: destinationContext.marketCode,
              localeCode: destinationContext.localeCode || null,
            } : {});
            hasContentUpdates = true;
          }
        }
        
        if (firstTitle) {
          if (shouldWriteLegacyOptimizedFields) {
            legacyUpdates.optimized_title = firstTitle;
            legacyUpdates.title_optimized_at = new Date().toISOString();
          }
          savedCount.titles++;
        }
        if (firstDesc) {
          if (shouldWriteLegacyOptimizedFields) {
            legacyUpdates.optimized_description = firstDesc;
            legacyUpdates.description_optimized_at = new Date().toISOString();
          }
          savedCount.descriptions++;
        }
        
        if (hasContentUpdates || Object.keys(legacyUpdates).length > 0) {
          const newCf = Object.keys(legacyUpdates).length > 0 ? { ...nextCf, ...legacyUpdates } : nextCf;
          await getPrisma().$executeRawUnsafe(
            `UPDATE "FeedItem" SET customfields = $1::jsonb, updatedat = NOW() WHERE id = $2::text`,
            JSON.stringify(newCf),
            product.id
          );
        }
      } catch (saveErr) {
        console.warn(`Erreur sauvegarde enrichissement ${product.id}:`, saveErr.message);
      }
    }
    
    results.saved = savedCount;

    trackAiUsage(accountId, products.length * Math.max(1, normalizedPlatforms.length));
    res.json(results);
  } catch (error) {
    console.error('Erreur batch:', error);
    res.status(500).json({ message: error.message });
  }
});

// === Calculer les scores en batch (pour la page /ia) ===
app.post('/api/v1/enrichment/scores', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ message: 'itemIds requis (array)' });
    }
    
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const placeholders = itemIds.map((_, i) => `$${i + 1}::text`).join(',');
    const acctParam2 = `$${itemIds.length + 1}::text`;
    const products = await getPrisma().$queryRawUnsafe(
      `SELECT i.* FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id WHERE i.id IN (${placeholders}) AND f.accountid = ${acctParam2}`,
      ...itemIds, req.accountId
    );
    
    const scores = {};
    for (const product of products) {
      const titleScore = calculateTitleScore(product.title || '', product);
      const descText = product.descriptiontext || '';
      const descriptionScore = calculateDescriptionScore(descText, product);
      
      let imageScore = 0;
      if (product.imageurl) imageScore += 60;
      
      let technicalScore = 0;
      const cf = product.customfields && typeof product.customfields === 'object' ? product.customfields : {};
      if (product.gtin || cf.gtin) technicalScore += 30;
      if (product.mpn || cf.mpn) technicalScore += 20;
      if (cf.google_product_category) technicalScore += 30;
      if (product.brand) technicalScore += 20;
      
      const globalScore = Math.round(
        titleScore * 0.30 + descriptionScore * 0.25 + imageScore * 0.25 + technicalScore * 0.20
      );
      
      scores[product.id] = {
        global: globalScore,
        title: titleScore,
        description: descriptionScore,
        image: imageScore,
        technical: technicalScore,
        hasOptimizedTitle: !!cf.optimized_title,
        hasOptimizedDescription: !!cf.optimized_description
      };
    }
    
    res.json({ scores });
  } catch (error) {
    console.error('Erreur scores batch:', error);
    res.status(500).json({ message: error.message });
  }
});

// Calculer le score FeedPlug d'un produit
app.get('/api/v1/enrichment/score/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    const accountId = req.accountId;
    if (!(await verifyItemAccess(itemId, accountId))) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const items = await getPrisma().$queryRawUnsafe(`
      SELECT i.* FROM "FeedItem" i
      JOIN "Feed" f ON i.feedid = f.id
      WHERE i.id = $1::text AND f.accountid = $2::text
    `, itemId, accountId);
    
    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    
    const product = items[0];
    const titleScore = calculateTitleScore(product.title || '', product);
    const descriptionScore = calculateDescriptionScore(product.descriptiontext || product.descriptionText || '', product);
    
    let imageScore = 0;
    if (product.imageurl || product.imageUrl) {
      imageScore += 60;
    }
    
    let technicalScore = 0;
    if (product.gtin || product.customfields?.gtin) technicalScore += 30;
    if (product.mpn || product.customfields?.mpn) technicalScore += 20;
    if (product.customfields?.google_product_category) technicalScore += 30;
    if (product.brand) technicalScore += 20;
    
    const globalScore = Math.round(titleScore * 0.30 + descriptionScore * 0.25 + imageScore * 0.25 + technicalScore * 0.20);
    
    const recommendations = [];
    if (titleScore < 70) recommendations.push({ type: 'title', priority: 'high', message: 'Titre à optimiser', action: 'Utilisez l\'optimisation IA' });
    if (descriptionScore < 60) recommendations.push({ type: 'description', priority: 'high', message: 'Description insuffisante', action: 'Générez une description optimisée' });
    if (imageScore < 60) recommendations.push({ type: 'image', priority: 'medium', message: 'Images à optimiser', action: 'Compressez et optimisez vos images' });
    if (technicalScore < 70) recommendations.push({ type: 'technical', priority: 'high', message: 'Données techniques manquantes', action: 'Ajoutez GTIN, MPN et catégorie' });
    
    res.json({
      globalScore,
      breakdown: {
        title: { score: titleScore, weight: '30%' },
        description: { score: descriptionScore, weight: '25%' },
        images: { score: imageScore, weight: '25%' },
        technical: { score: technicalScore, weight: '20%' }
      },
      recommendations
    });
  } catch (error) {
    console.error('Erreur score:', error);
    res.status(500).json({ message: error.message });
  }
});

// === Segments pour A/B test ===
app.get('/api/v1/enrichment/segments', async (req, res) => {
  try {
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const acct = req.accountId;
    
    // Marques (top 30) — filtré par account
    const brands = await getPrisma().$queryRawUnsafe(`
      SELECT i.brand, COUNT(*)::int as count 
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE i.brand IS NOT NULL AND i.brand != '' AND f.accountid = $1::text
      GROUP BY i.brand ORDER BY count DESC LIMIT 30
    `, acct);
    
    // Catégories produit (top 30)
    const categories = await getPrisma().$queryRawUnsafe(`
      SELECT i.customfields->>'product_type' as category, COUNT(*)::int as count
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE i.customfields->>'product_type' IS NOT NULL AND f.accountid = $1::text
      GROUP BY 1 ORDER BY count DESC LIMIT 30
    `, acct);
    
    // Tranches de prix
    const priceRanges = await getPrisma().$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.price < 10 THEN 1 END)::int as "under10",
        COUNT(CASE WHEN i.price >= 10 AND i.price < 30 THEN 1 END)::int as "10to30",
        COUNT(CASE WHEN i.price >= 30 AND i.price < 50 THEN 1 END)::int as "30to50",
        COUNT(CASE WHEN i.price >= 50 AND i.price < 100 THEN 1 END)::int as "50to100",
        COUNT(CASE WHEN i.price >= 100 THEN 1 END)::int as "over100"
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE i.price IS NOT NULL AND f.accountid = $1::text
    `, acct);
    
    // Stock
    const stockInfo = await getPrisma().$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.inventory > 0 THEN 1 END)::int as "inStock",
        COUNT(CASE WHEN i.inventory = 0 OR i.inventory IS NULL THEN 1 END)::int as "outOfStock"
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text
    `, acct);
    
    // Score (déjà optimisé vs pas)
    const enrichmentInfo = await getPrisma().$queryRawUnsafe(`
      SELECT 
        COUNT(CASE WHEN i.customfields->>'optimized_title' IS NOT NULL THEN 1 END)::int as "hasOptTitle",
        COUNT(CASE WHEN i.customfields->>'optimized_title' IS NULL THEN 1 END)::int as "noOptTitle",
        COUNT(CASE WHEN i.customfields->>'optimized_description' IS NOT NULL THEN 1 END)::int as "hasOptDesc",
        COUNT(CASE WHEN i.customfields->>'optimized_description' IS NULL THEN 1 END)::int as "noOptDesc",
        COUNT(*)::int as total
      FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id
      WHERE f.accountid = $1::text
    `, acct);
    
    res.json({
      brands: brands || [],
      categories: categories || [],
      priceRanges: priceRanges?.[0] || {},
      stock: stockInfo?.[0] || {},
      enrichment: enrichmentInfo?.[0] || {},
      total: enrichmentInfo?.[0]?.total || 0
    });
  } catch (error) {
    console.error('Erreur segments:', error);
    res.status(500).json({ message: error.message });
  }
});

// Filtrer les items par segment
app.post('/api/v1/enrichment/filter-items', async (req, res) => {
  try {
    if (!getPrismaReady?.() || !getPrisma()) {
      return res.status(503).json({ message: 'Service non disponible' });
    }
    
    const { brands, categories, priceRange, stockFilter, enrichmentFilter, limit } = req.body;
    
    let conditions = [];
    let params = [];
    let paramIdx = 1;
    
    if (brands && brands.length > 0) {
      const placeholders = brands.map(() => `$${paramIdx++}::text`).join(',');
      conditions.push(`brand IN (${placeholders})`);
      params.push(...brands);
    }
    
    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => `$${paramIdx++}::text`).join(',');
      conditions.push(`customfields->>'product_type' IN (${placeholders})`);
      params.push(...categories);
    }
    
    if (priceRange) {
      if (priceRange.min !== undefined) {
        conditions.push(`price >= $${paramIdx++}::numeric`);
        params.push(priceRange.min);
      }
      if (priceRange.max !== undefined) {
        conditions.push(`price <= $${paramIdx++}::numeric`);
        params.push(priceRange.max);
      }
    }
    
    if (stockFilter === 'in_stock') {
      conditions.push(`inventory > 0`);
    } else if (stockFilter === 'out_of_stock') {
      conditions.push(`(inventory = 0 OR inventory IS NULL)`);
    }
    
    if (enrichmentFilter === 'not_optimized') {
      conditions.push(`(customfields->>'optimized_title' IS NULL)`);
    } else if (enrichmentFilter === 'already_optimized') {
      conditions.push(`(customfields->>'optimized_title' IS NOT NULL)`);
    }
    
    // Ajouter filtre multi-tenant via JOIN Feed
    conditions.push(`f.accountid = $${paramIdx}::text`);
    params.push(req.accountId);
    paramIdx++;
    
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const maxLimit = Math.min(parseInt(limit) || 5000, 10000);
    
    const query = `SELECT i.id FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id ${where} LIMIT $${paramIdx}::int`;
    params.push(maxLimit);
    
    const items = await getPrisma().$queryRawUnsafe(query, ...params);
    
    // Compter le total (sans limit)
    const countQuery = `SELECT COUNT(*)::int as total FROM "FeedItem" i JOIN "Feed" f ON i.feedid = f.id ${where}`;
    const countParams = params.slice(0, -1); // sans le limit
    const countResult = await getPrisma().$queryRawUnsafe(countQuery, ...countParams);
    
    res.json({
      itemIds: (items || []).map((i) => i.id),
      total: countResult?.[0]?.total || 0,
      limited: maxLimit
    });
  } catch (error) {
    console.error('Erreur filter-items:', error);
    res.status(500).json({ message: error.message });
  }
});
}

module.exports = { registerEnrichmentRoutes };
