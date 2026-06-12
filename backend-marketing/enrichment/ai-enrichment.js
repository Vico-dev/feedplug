/**
 * Module d'enrichissement avec IA (Gemini, OpenAI, etc.)
 * Utilise l'IA pour déduire des champs complexes
 */

/**
 * Enrichit un produit avec l'IA pour les champs complexes
 */
async function enrichWithAI(prisma, item, fieldsToEnrich = []) {
  const enrichments = {};
  const errors = [];
  
  // Si aucun champ spécifié, enrichir les champs recommandés manquants
  if (fieldsToEnrich.length === 0) {
    fieldsToEnrich = ['google_product_category', 'description', 'brand', 'material', 'pattern'];
  }
  
  // Préparer le contexte pour l'IA
  const context = buildContext(item);
  
  // Enrichir chaque champ avec l'IA
  for (const field of fieldsToEnrich) {
    try {
      const enriched = await enrichFieldWithAI(prisma, item, field, context);
      if (enriched) {
        enrichments[field] = enriched;
      }
    } catch (error) {
      console.warn(`Erreur enrichissement IA pour ${field}:`, error.message);
      errors.push({ field, error: error.message });
    }
  }
  
  return { enrichments, errors };
}

/**
 * Construit le contexte pour l'IA à partir des données du produit
 */
function buildContext(item) {
  const customFields = item.customFields || (item.customfields ? (typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields) : {});
  
  return {
    title: item.title || '',
    description: item.descriptionText || item.descriptionHtml || '',
    brand: item.brand || customFields.brand || '',
    price: item.price || '',
    category: customFields.product_type || customFields.category || '',
    color: customFields.color || '',
    size: customFields.size || '',
    sku: item.sku || '',
    gtin: item.gtin || '',
    mpn: item.mpn || ''
  };
}

/**
 * Enrichit un champ spécifique avec l'IA
 */
async function enrichFieldWithAI(prisma, item, field, context) {
  // Vérifier si on a une clé API Gemini disponible
  let geminiApiKey = null;
  
  try {
    // Essayer de récupérer une clé Gemini depuis la base de données
    const providerKey = await prisma.$queryRawUnsafe(`
      SELECT * FROM "AIProviderKey" 
      WHERE providerid = 'gemini' 
      AND isactive = true 
      AND (dailylimit IS NULL OR dailyusage < dailylimit)
      AND (monthlylimit IS NULL OR monthlyusage < monthlylimit)
      ORDER BY isdefault DESC, createdat ASC
      LIMIT 1
    `);
    
    if (providerKey && providerKey.length > 0) {
      geminiApiKey = providerKey[0].apikey;
    } else {
      // Fallback sur la variable d'environnement
      geminiApiKey = process.env.GEMINI_API_KEY;
    }
  } catch (error) {
    console.warn('Erreur récupération clé Gemini:', error.message);
    geminiApiKey = process.env.GEMINI_API_KEY;
  }
  
  if (!geminiApiKey) {
    throw new Error('Aucune clé API Gemini disponible');
  }
  
  // Construire le prompt selon le champ
  const prompt = buildPromptForField(field, context);
  
  // Appeler Gemini API
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
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
    
    // Parser et nettoyer la réponse
    return parseAIResponse(field, text);
    
  } catch (error) {
    console.error(`Erreur appel Gemini pour ${field}:`, error);
    throw error;
  }
}

/**
 * Construit le prompt pour un champ spécifique
 */
function buildPromptForField(field, context) {
  const basePrompt = `Tu es un expert en e-commerce et Google Merchant Center. Analyse les informations suivantes d'un produit et réponds UNIQUEMENT avec la valeur demandée, sans explication supplémentaire.

Produit:
- Titre: ${context.title || 'Non disponible'}
- Description: ${context.description || 'Non disponible'}
- Marque: ${context.brand || 'Non disponible'}
- Prix: ${context.price || 'Non disponible'}
- Catégorie: ${context.category || 'Non disponible'}
- Couleur: ${context.color || 'Non disponible'}
- Taille: ${context.size || 'Non disponible'}
- SKU: ${context.sku || 'Non disponible'}
- GTIN: ${context.gtin || 'Non disponible'}
- MPN: ${context.mpn || 'Non disponible'}

`;

  switch (field) {
    case 'google_product_category':
      return basePrompt + `Détermine la catégorie Google Product Category la plus précise pour ce produit. Réponds UNIQUEMENT avec la catégorie complète au format "Category > Subcategory > Sub-subcategory" (ex: "Apparel & Accessories > Clothing > Shirts & Tops"). Si tu ne peux pas déterminer, réponds "UNKNOWN".`;
    
    case 'description':
      return basePrompt + `Génère une description optimisée pour Google Shopping (500-1000 caractères) en français. La description doit être attractive, inclure les mots-clés importants, et mettre en avant les caractéristiques principales du produit. Réponds UNIQUEMENT avec la description, sans préfixe ni explication.`;
    
    case 'brand':
      return basePrompt + `Détermine la marque du produit. Si la marque est clairement identifiable dans le titre ou les informations, réponds UNIQUEMENT avec le nom de la marque. Sinon, réponds "UNKNOWN".`;
    
    case 'material':
      return basePrompt + `Détermine le matériau principal du produit. Réponds UNIQUEMENT avec le matériau (ex: "Cotton", "Polyester", "Leather"). Si tu ne peux pas déterminer, réponds "UNKNOWN".`;
    
    case 'pattern':
      return basePrompt + `Détermine le motif/pattern du produit s'il en a un. Réponds UNIQUEMENT avec le motif (ex: "Solid", "Striped", "Floral"). Si le produit n'a pas de motif, réponds "UNKNOWN".`;
    
    default:
      return basePrompt + `Détermine la valeur pour le champ "${field}". Réponds UNIQUEMENT avec la valeur, sans explication. Si tu ne peux pas déterminer, réponds "UNKNOWN".`;
  }
}

/**
 * Parse et nettoie la réponse de l'IA
 */
function parseAIResponse(field, text) {
  // Nettoyer la réponse
  let cleaned = text.trim();
  
  // Retirer les guillemets si présents
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  // Pour google_product_category, vérifier le format
  if (field === 'google_product_category') {
    if (cleaned === 'UNKNOWN' || cleaned.toLowerCase().includes('je ne peux pas')) {
      return null;
    }
    // Vérifier que c'est bien au format "Category > Subcategory"
    if (!cleaned.includes('>')) {
      return null;
    }
  }
  
  // Pour les autres champs, retourner null si UNKNOWN
  if (cleaned === 'UNKNOWN' || cleaned.toLowerCase().includes('je ne peux pas')) {
    return null;
  }
  
  return cleaned;
}

module.exports = {
  enrichWithAI,
  enrichFieldWithAI,
  buildContext
};

