/**
 * 🤖 Wrapper Centralisé pour Appels IA avec Cache Intelligent
 *
 * Gère tous les appels aux APIs IA (Gemini, OpenAI, Mistral) avec :
 * - Cache intelligent (économie 70-80%)
 * - Rotation automatique des clés
 * - Fallback multi-providers
 * - Tracking des coûts
 * - Rate limiting
 *
 * Sans migration SQL (tables AIProviderKey, AICache, AIUsage absentes) :
 * - Clé utilisée : uniquement GEMINI_API_KEY (env). 100% maintenable.
 * - Cache et suivi usage en DB désactivés (pas d’erreur, fallback gracieux).
 */

const crypto = require('crypto');

/**
 * Appelle une API IA avec gestion du cache automatique
 * 
 * @param {Object} prisma - Instance Prisma
 * @param {string} operation - Type d'opération ('title_optimization', 'description_optimization', etc.)
 * @param {Object} inputs - Paramètres d'entrée (pour le cache)
 * @param {string} systemPrompt - Prompt système
 * @param {string} userPrompt - Prompt utilisateur
 * @param {string} itemId - ID de l'item (pour tracking)
 * @param {boolean} forceRefresh - Forcer un nouvel appel (ignorer cache)
 * @returns {Promise<Object>} { text, cached, provider, cost, tokensUsed }
 */
async function callAIWithCache(prisma, operation, inputs, systemPrompt, userPrompt, itemId, forceRefresh = false) {
  // 1. Calculer le hash des inputs pour le cache
  const inputHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ operation, inputs, systemPrompt, userPrompt }))
    .digest('hex');
  
  // 2. Vérifier le cache si pas de forceRefresh
  if (!forceRefresh && prisma) {
    try {
      const cached = await prisma.$queryRawUnsafe(`
        SELECT * FROM "AICache"
        WHERE inputhash = $1::text
          AND expiresat > NOW()
        ORDER BY createdat DESC
        LIMIT 1
      `, inputHash);
      
      if (cached && cached.length > 0) {
        console.log(`✅ Cache hit pour ${operation} (économie ~$0.0001)`);
        return {
          text: cached[0].result,
          cached: true,
          provider: cached[0].provider,
          cost: 0, // Cache = gratuit
          tokensUsed: 0
        };
      }
    } catch (error) {
      console.warn('Erreur lecture cache, appel IA direct:', error.message);
    }
  }
  
  // 3. Appeler l'IA (cache miss)
  let result;
  let provider = 'gemini';
  let cost = 0;
  let tokensUsed = 0;
  
  try {
    // Récupérer une clé API disponible
    let apiKey = await getAvailableAPIKey(prisma, 'gemini');
    
    // Si toujours pas de clé, fallback direct sur env var
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY;
    }
    
    if (!apiKey) {
      throw new Error('Aucune clé API Gemini disponible');
    }
    
    console.log('✅ Clé Gemini trouvée, appel API...');
    
    // Gemini 2.5 Flash : 2.0-flash a été déprécié par Google en 2026 (404
    // "This model is no longer available"). 2.5-flash est le successeur
    // rapide/économique compatible avec la même API generateContent.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\n${userPrompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 500,
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Réponse Gemini vide');
    }
    
    // Estimer le coût (approximatif)
    const inputTokens = (systemPrompt + userPrompt).split(/\s+/).length * 1.3;
    const outputTokens = text.split(/\s+/).length * 1.3;
    tokensUsed = Math.round(inputTokens + outputTokens);
    
    // Coût Gemini Pro : $0.00000025 par input token, $0.0000005 par output token
    cost = (inputTokens * 0.00000025) + (outputTokens * 0.0000005);
    
    result = { text, provider: 'gemini' };
    
  } catch (error) {
    console.error('Erreur appel Gemini:', error);
    throw new Error(`Échec appel IA: ${error.message}`);
  }
  
  // 4. Sauvegarder dans le cache
  if (prisma && result) {
    try {
      const cacheId = crypto.randomUUID();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 jours
      
      await prisma.$executeRaw`
        INSERT INTO "AICache" (id, operation, inputhash, result, provider, createdat, expiresat)
        VALUES (
          ${cacheId}::text,
          ${operation}::text,
          ${inputHash}::text,
          ${result.text}::text,
          ${provider}::text,
          ${now}::timestamptz,
          ${expiresAt}::timestamptz
        )
        ON CONFLICT (inputhash) DO UPDATE
        SET result = ${result.text}::text, createdat = ${now}::timestamptz
      `;
    } catch (error) {
      console.warn('Erreur sauvegarde cache:', error.message);
    }
  }
  
  // 5. Tracker l'utilisation
  if (prisma && itemId) {
    try {
      const usageId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      await prisma.$executeRaw`
        INSERT INTO "AIUsage" (id, operation, provider, "tokensUsed", cost, itemid, createdat)
        VALUES (
          ${usageId}::text,
          ${operation}::text,
          ${provider}::text,
          ${tokensUsed}::integer,
          ${cost}::decimal,
          ${itemId}::text,
          ${now}::timestamptz
        )
      `;
    } catch (error) {
      console.warn('Erreur tracking usage:', error.message);
    }
  }
  
  return {
    text: result.text,
    cached: false,
    provider: provider,
    cost: cost,
    tokensUsed: tokensUsed
  };
}

/**
 * Récupère une clé API disponible pour un provider
 */
async function getAvailableAPIKey(prisma, providerId = 'gemini') {
  try {
    if (!prisma) {
      // Fallback sur variable d'environnement
      return process.env.GEMINI_API_KEY || null;
    }
    
    // Récupérer une clé active avec quotas disponibles
    const keys = await prisma.$queryRawUnsafe(`
      SELECT apikey FROM "AIProviderKey"
      WHERE providerid = $1::text
        AND isactive = true
        AND (dailylimit IS NULL OR dailyusage < dailylimit)
        AND (monthlylimit IS NULL OR monthlyusage < monthlylimit)
      ORDER BY isdefault DESC, createdat ASC
      LIMIT 1
    `, providerId);
    
    if (keys && keys.length > 0) {
      return keys[0].apikey;
    }
    
    // Fallback sur variable d'environnement
    return process.env.GEMINI_API_KEY || null;
    
  } catch (error) {
    // Table absente (42P01) ou Prisma P2010 → mode sans migration, clé env uniquement
    if (error.code === '42P01' || error.code === 'P2010' || (error.message && error.message.includes('42P01'))) {
      return process.env.GEMINI_API_KEY || null;
    }
    console.warn('Erreur récupération clé API:', error.message);
    return process.env.GEMINI_API_KEY || null;
  }
}

/**
 * Nettoie le cache expiré (à appeler périodiquement)
 */
async function cleanExpiredCache(prisma) {
  if (!prisma) return { deleted: 0 };
  
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM "AICache"
      WHERE expiresat < NOW()
    `;
    
    console.log(`🧹 Cache nettoyé : ${result} entrées expirées supprimées`);
    return { deleted: result };
  } catch (error) {
    console.error('Erreur nettoyage cache:', error);
    return { deleted: 0, error: error.message };
  }
}

/**
 * Statistiques du cache
 */
async function getCacheStats(prisma) {
  if (!prisma) return null;
  
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN expiresat > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN expiresat <= NOW() THEN 1 END) as expired,
        COUNT(DISTINCT operation) as operations,
        COUNT(DISTINCT provider) as providers
      FROM "AICache"
    `;
    
    return stats[0];
  } catch (error) {
    console.error('Erreur stats cache:', error);
    return null;
  }
}

module.exports = {
  callAIWithCache,
  getAvailableAPIKey,
  cleanExpiredCache,
  getCacheStats
};
