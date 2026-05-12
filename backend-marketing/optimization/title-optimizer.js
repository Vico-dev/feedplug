/**
 * 🎯 Module d'Optimisation des Titres Produits avec IA
 * 
 * Génère des titres optimisés pour Google Merchant Center et autres plateformes
 * avec templates spécialisés par industrie pour une qualité maximale.
 * 
 * Features:
 * - 5 templates par industrie (Mode, Beauté, Tech, Food, Home)
 * - Respect strict limites GMC (150 caractères)
 * - Cache intelligent (économie 70-80%)
 * - Fallback sur règles basiques si IA échoue
 * - Validation conformité GMC
 */

const { callAIWithCache } = require('../ai/ai-wrapper');
const { GMC_TITLE_RULES, applyGmcTitlePostCheck } = require('./gmc-guidelines');
const {
  buildLocalizationPrompt,
  buildOptimizationTargetCacheKey,
  resolveOptimizationTarget,
} = require('./destination-prompt-context');

// Limites de caractères par plateforme
const PLATFORM_LIMITS = {
  GMC: 150,
  META: 200,
  AMAZON: 200,
  CHATGPT: 150,
  PINTEREST: 100,
  TIKTOK: 34
};

// Conseils par plateforme (ajoutés au prompt pour adapter le style)
const PLATFORM_HINTS = {
  GMC: 'Style Google Shopping : mots-clés SEO, format [Marque] [Type] [Attributs], optimisé pour la recherche produit.',
  META: 'Style Meta (Facebook/Instagram) : accrocheur, émotionnel, court et percutant. Mettre en avant le bénéfice ou l\'aspiration.',
  AMAZON: 'Style Amazon : orienté bénéfices client, mots-clés A9, format vendeur. Privilégier les termes de recherche acheteurs.',
  CHATGPT: 'Style ChatGPT/LLM : factuel, structuré, informatif. Optimisé pour la découverte par assistant IA (résumé clair du produit).'
};

// Détection automatique de l'industrie depuis la catégorie
function detectIndustry(product) {
  const category = (product.customfields?.google_product_category || product.google_product_category || '').toLowerCase();
  const title = (product.title || '').toLowerCase();
  const description = (product.descriptiontext || product.descriptionText || '').toLowerCase();
  const allText = category + ' ' + title + ' ' + description;
  
  // Mode & Accessoires
  if (allText.match(/apparel|clothing|fashion|vetement|mode|shirt|pant|dress|shoes|chaussures|accessoires|bijoux|jewelry/i)) {
    return 'fashion';
  }
  
  // Beauté & Santé
  if (allText.match(/beauty|health|cosmetic|skincare|makeup|parfum|perfume|soin|creme|serum|beaute|sante|hygiene/i)) {
    return 'beauty';
  }
  
  // High-Tech & Électronique
  if (allText.match(/electronics|computer|phone|tablet|audio|video|camera|tv|laptop|smartphone|tech|electronique|informatique/i)) {
    return 'tech';
  }
  
  // Alimentaire & Boissons
  if (allText.match(/food|beverage|drink|grocery|gourmet|bio|organic|alimentaire|boisson|nourriture|epicerie/i)) {
    return 'food';
  }
  
  // Maison & Déco
  if (allText.match(/home|furniture|decor|garden|kitchen|bedroom|living|maison|meuble|decoration|jardin|cuisine/i)) {
    return 'home';
  }
  
  // Défaut
  return 'general';
}

// Templates de prompts par industrie
const INDUSTRY_TEMPLATES = {
  fashion: {
    name: 'Mode & Accessoires',
    systemPrompt: `Tu es un expert en e-commerce mode et Google Merchant Center.
Tu dois générer des titres produits optimisés pour maximiser le CTR et les conversions.`,
    userPromptTemplate: (product) => `Génère un titre optimisé pour ce produit mode :

Informations produit :
- Titre actuel : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Catégorie : ${product.customfields?.product_type || 'Non spécifié'}
- Couleur : ${product.customfields?.color || 'Non spécifié'}
- Taille : ${product.customfields?.size || 'Non spécifié'}
- Matière : ${product.customfields?.material || 'Non spécifié'}
- Genre : ${product.customfields?.gender || 'Non spécifié'}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Règles strictes :
1. Maximum 150 caractères (IMPÉRATIF)
2. Format : [Marque] [Type de vêtement] [Attributs clés] - [Genre/Taille]
3. Inclure OBLIGATOIREMENT : marque, type, couleur OU matière, taille ou genre
4. Exemple : "Nike Air Max 90 - Baskets Running Homme Bleu Marine - Taille 42"
5. Pas de keyword stuffing
6. Naturel et professionnel
7. Mots-clés pertinents pour le SEO
8. Si information manquante, ne pas inventer

Réponds UNIQUEMENT avec le titre optimisé, sans explication ni préfixe.`
  },
  
  beauty: {
    name: 'Beauté & Santé',
    systemPrompt: `Tu es un expert en e-commerce beauté/cosmétique et Google Merchant Center.
Tu dois générer des titres produits optimisés pour maximiser le CTR et les conversions.`,
    userPromptTemplate: (product) => `Génère un titre optimisé pour ce produit beauté :

Informations produit :
- Titre actuel : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Volume : ${product.customfields?.size || 'Non spécifié'}
- Bénéfices : ${product.descriptiontext?.substring(0, 200) || 'Non spécifié'}
- Certifications : ${product.customfields?.adult === 'no' ? 'Tout public' : ''}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Règles strictes :
1. Maximum 150 caractères (IMPÉRATIF)
2. Format : [Marque] [Type de produit] [Bénéfice principal] - [Volume/Quantité] - [Certifications si pertinent]
3. Exemple : "L'Oréal Sérum Anti-Âge Hyaluronique - 30ml - Dermatologiquement Testé"
4. Mettre en avant : ingrédients star, bénéfices, certifications (bio, vegan, cruelty-free)
5. Pas de claims santé non prouvés
6. Naturel et rassurant
7. Si information manquante, ne pas inventer

Réponds UNIQUEMENT avec le titre optimisé, sans explication ni préfixe.`
  },
  
  tech: {
    name: 'High-Tech & Électronique',
    systemPrompt: `Tu es un expert en e-commerce high-tech et Google Merchant Center.
Tu dois générer des titres produits optimisés pour maximiser le CTR et les conversions.`,
    userPromptTemplate: (product) => `Génère un titre optimisé pour ce produit tech :

Informations produit :
- Titre actuel : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Modèle : ${product.mpn || product.customfields?.mpn || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Specs : ${product.descriptiontext?.substring(0, 300) || 'Non spécifié'}
- Couleur : ${product.customfields?.color || 'Non spécifié'}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Règles strictes :
1. Maximum 150 caractères (IMPÉRATIF)
2. Format : [Marque] [Modèle] [Type] - [Specs clés] - [Couleur]
3. Exemple : "Apple iPhone 15 Pro Max 256Go - Écran 6.7" OLED - Titane Bleu"
4. Inclure specs importantes : RAM, stockage, taille écran, processeur
5. Précis et technique
6. Modèle exact si disponible
7. Pas de superlatifs marketing ("le meilleur")
8. Si information manquante, ne pas inventer

Réponds UNIQUEMENT avec le titre optimisé, sans explication ni préfixe.`
  },
  
  food: {
    name: 'Alimentaire & Boissons',
    systemPrompt: `Tu es un expert en e-commerce alimentaire et Google Merchant Center.
Tu dois générer des titres produits optimisés pour maximiser le CTR et les conversions.`,
    userPromptTemplate: (product) => `Génère un titre optimisé pour ce produit alimentaire :

Informations produit :
- Titre actuel : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Poids/Volume : ${product.customfields?.size || 'Non spécifié'}
- Ingrédients : ${product.descriptiontext?.substring(0, 200) || 'Non spécifié'}
- Origine : ${product.customfields?.country_of_origin || 'Non spécifié'}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Règles strictes :
1. Maximum 150 caractères (IMPÉRATIF)
2. Format : [Marque] [Type] [Caractéristiques] - [Poids/Volume] - [Certifications]
3. Exemple : "Bjorg Muesli Bio Fruits & Noix - 500g - Certifié AB Sans Gluten"
4. Inclure : type précis, poids/volume, certifications (bio, AOC, label rouge)
5. Mentionner allergènes si pertinent ("Sans gluten", "Sans lactose")
6. Origine si valorisante ("Fait en France", "Produit Italien")
7. Pas de claims santé non autorisés
8. Si information manquante, ne pas inventer

Réponds UNIQUEMENT avec le titre optimisé, sans explication ni préfixe.`
  },
  
  home: {
    name: 'Maison & Déco',
    systemPrompt: `Tu es un expert en e-commerce maison/décoration et Google Merchant Center.
Tu dois générer des titres produits optimisés pour maximiser le CTR et les conversions.`,
    userPromptTemplate: (product) => `Génère un titre optimisé pour ce produit maison/déco :

Informations produit :
- Titre actuel : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Dimensions : ${product.customfields?.size || 'Non spécifié'}
- Matière : ${product.customfields?.material || 'Non spécifié'}
- Couleur : ${product.customfields?.color || 'Non spécifié'}
- Style : ${product.customfields?.pattern || 'Non spécifié'}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Règles strictes :
1. Maximum 150 caractères (IMPÉRATIF)
2. Format : [Type] [Marque] [Matière] [Dimensions] - [Couleur/Style]
3. Exemple : "Lampe de Table IKEA Métal Noir 45cm - Design Scandinave Moderne"
4. Inclure : type précis, dimensions, matière, style/couleur
5. Style déco si pertinent (Scandinave, Industriel, Bohème, etc.)
6. Dimensions claires (cm, L×l×h)
7. Pas de superlatifs exagérés
8. Si information manquante, ne pas inventer

Réponds UNIQUEMENT avec le titre optimisé, sans explication ni préfixe.`
  },
  
  general: {
    name: 'Général',
    systemPrompt: `Tu es un expert en e-commerce et Google Merchant Center.
Tu dois générer des titres produits optimisés pour maximiser le CTR et les conversions.`,
    userPromptTemplate: (product) => `Génère un titre optimisé pour ce produit :

Informations produit :
- Titre actuel : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Catégorie : ${product.customfields?.google_product_category || 'Non spécifié'}
- Description : ${product.descriptiontext?.substring(0, 200) || 'Non spécifié'}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Règles strictes :
1. Maximum 150 caractères (IMPÉRATIF)
2. Format : [Marque] [Type de produit] [Caractéristiques principales]
3. Inclure marque + type + 1-2 attributs différenciants
4. Naturel et professionnel
5. Mots-clés pertinents
6. Pas de keyword stuffing
7. Si information manquante, ne pas inventer

Réponds UNIQUEMENT avec le titre optimisé, sans explication ni préfixe.`
  }
};

/**
 * Optimise un titre produit avec IA
 * @param {Object} prisma - Instance Prisma
 * @param {Object} product - Données produit
 * @param {Object} options - Options (platform, forceRefresh, industry)
 * @returns {Promise<Object>} { optimizedTitle, originalTitle, industry, score, cached }
 */
async function optimizeTitleWithAI(prisma, product, options = {}) {
  const platform = options.platform || 'GMC';
  const forceRefresh = options.forceRefresh || false;
  const manualIndustry = options.industry || null;
  const targetContext = resolveOptimizationTarget(options);
  
  // Validation des inputs
  if (!product || !product.id) {
    throw new Error('Produit invalide (ID manquant)');
  }
  
  const originalTitle = product.title || 'Produit sans titre';
  
  // Si le titre est déjà optimal, ne pas optimiser (sauf si forceRefresh)
  if (!forceRefresh && isAlreadyOptimal(originalTitle, product)) {
    return {
      optimizedTitle: originalTitle,
      originalTitle: originalTitle,
      industry: detectIndustry(product),
      score: 95,
      cached: false,
      skipped: true,
      reason: 'Titre déjà optimal'
    };
  }
  
  // Détecter l'industrie
  const industry = manualIndustry || detectIndustry(product);
  const template = INDUSTRY_TEMPLATES[industry] || INDUSTRY_TEMPLATES.general;
  
  // Préparer le prompt avec conseil plateforme + règles GMC explicites si Google
  const maxLength = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.GMC;
  const platformHint = PLATFORM_HINTS[platform] || PLATFORM_HINTS.GMC;
  const systemPrompt = platform === 'GMC'
    ? template.systemPrompt + GMC_TITLE_RULES
    : template.systemPrompt;
  const baseUserPrompt = template.userPromptTemplate(product);
  const userPrompt = `${baseUserPrompt}\n\n[Contexte plateforme] ${platformHint}${buildLocalizationPrompt(targetContext)}\nLimite : ${maxLength} caractères max.`;
  
  try {
    // Appeler l'IA avec cache
    const result = await callAIWithCache(
      prisma,
      'title_optimization',
      {
        productId: product.id,
        title: originalTitle,
        brand: product.brand || product.customfields?.brand,
        category: product.customfields?.google_product_category,
        industry: industry,
        platform: platform,
        target: buildOptimizationTargetCacheKey(targetContext),
      },
      systemPrompt,
      userPrompt,
      product.id,
      forceRefresh
    );
    
    if (!result || !result.text) {
      throw new Error('Réponse IA vide');
    }
    
    // Nettoyer et valider le titre généré
    let optimizedTitle = cleanTitle(result.text);

    // Conformité GMC : retirer résidus promotionnels, normaliser majuscules
    if (platform === 'GMC') {
      optimizedTitle = applyGmcTitlePostCheck(optimizedTitle);
    }

    // Valider la longueur selon la plateforme
    const maxLength = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.GMC;
    if (optimizedTitle.length > maxLength) {
      optimizedTitle = truncateTitle(optimizedTitle, maxLength);
    }
    
    // Calculer le score d'amélioration
    const score = calculateTitleScore(optimizedTitle, product);
    
    return {
      optimizedTitle: optimizedTitle,
      originalTitle: originalTitle,
      industry: industry,
      industryName: template.name,
      score: score,
      cached: result.cached || false,
      provider: result.provider || 'gemini',
      cost: result.cost || 0,
      improvement: score - calculateTitleScore(originalTitle, product)
    };
    
  } catch (error) {
    console.error('Erreur optimisation titre IA:', error);
    
    // Fallback sur règles basiques
    console.log('Fallback sur optimisation par règles basiques');
    return optimizeTitleWithRules(product, platform);
  }
}

/**
 * Optimise un titre avec des règles basiques (sans IA)
 * Fallback rapide et gratuit
 */
function optimizeTitleWithRules(product, platform = 'GMC') {
  const maxLength = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.GMC;
  
  const parts = [];
  
  // 1. Marque (prioritaire)
  const brand = product.brand || product.customfields?.brand;
  if (brand && brand !== 'Non spécifié') {
    parts.push(brand);
  }
  
  // 2. Type de produit (extrait du titre ou product_type)
  const productType = product.customfields?.product_type || extractProductType(product.title);
  if (productType) {
    parts.push(productType);
  }
  
  // 3. Attributs clés (couleur, taille, matière)
  const attributes = [];
  if (product.customfields?.color) attributes.push(product.customfields.color);
  if (product.customfields?.size) attributes.push(product.customfields.size);
  if (product.customfields?.material) attributes.push(product.customfields.material);
  
  if (attributes.length > 0) {
    parts.push(attributes.join(' '));
  }
  
  // 4. Genre si pertinent
  if (product.customfields?.gender && product.customfields.gender !== 'unisex') {
    const genderLabel = product.customfields.gender === 'male' ? 'Homme' : 'Femme';
    parts.push(genderLabel);
  }
  
  // Assembler
  let title = parts.join(' - ');
  
  // Limiter à la longueur max
  if (title.length > maxLength) {
    title = truncateTitle(title, maxLength);
  }
  
  // Si le titre est trop court, utiliser le titre original
  if (title.length < 20) {
    title = product.title || 'Produit';
    if (title.length > maxLength) {
      title = truncateTitle(title, maxLength);
    }
  }
  
  return {
    optimizedTitle: title,
    originalTitle: product.title || '',
    industry: 'general',
    industryName: 'Général',
    score: calculateTitleScore(title, product),
    cached: false,
    provider: 'rules',
    cost: 0,
    improvement: calculateTitleScore(title, product) - calculateTitleScore(product.title || '', product)
  };
}

/**
 * Vérifie si un titre est déjà optimal
 */
function isAlreadyOptimal(title, product) {
  if (!title || title.length < 20) return false;
  if (title.length > 150) return false;
  
  // Vérifier que le titre contient la marque
  const brand = product.brand || product.customfields?.brand;
  if (brand && !title.toLowerCase().includes(brand.toLowerCase())) {
    return false;
  }
  
  // Si le score est déjà élevé, considérer comme optimal
  const score = calculateTitleScore(title, product);
  return score >= 85;
}

/**
 * Nettoie un titre généré par l'IA
 */
function cleanTitle(title) {
  if (!title) return '';
  
  // Retirer les guillemets
  let cleaned = title.trim().replace(/^["']|["']$/g, '');
  
  // Retirer les préfixes courants que l'IA ajoute parfois
  cleaned = cleaned.replace(/^(Titre optimisé|Titre|Title):\s*/i, '');
  cleaned = cleaned.replace(/^Voici le titre optimisé:\s*/i, '');
  
  // Retirer les retours à la ligne
  cleaned = cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  // Capitalisation correcte (première lettre majuscule, mais respecter les acronymes)
  // Ne pas modifier si déjà bien formaté
  
  return cleaned.trim();
}

/**
 * Tronque un titre intelligemment à une longueur max
 */
function truncateTitle(title, maxLength) {
  if (title.length <= maxLength) return title;
  
  // Tronquer au dernier espace avant la limite
  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    // Si le dernier espace est dans les 80% finaux, tronquer là
    return truncated.substring(0, lastSpace).trim();
  } else {
    // Sinon, tronquer sec et ajouter "..."
    return truncated.substring(0, maxLength - 3).trim() + '...';
  }
}

/**
 * Extrait le type de produit depuis le titre
 */
function extractProductType(title) {
  if (!title) return null;
  
  const commonTypes = [
    't-shirt', 'shirt', 'pantalon', 'robe', 'chaussures', 'baskets',
    'sac', 'montre', 'lunettes', 'parfum', 'crème', 'sérum',
    'téléphone', 'ordinateur', 'écouteurs', 'casque', 'clavier',
    'table', 'chaise', 'lampe', 'tapis', 'coussin'
  ];
  
  const lowerTitle = title.toLowerCase();
  for (const type of commonTypes) {
    if (lowerTitle.includes(type)) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  
  // Si pas trouvé, prendre les 2-3 premiers mots après la marque
  const words = title.split(/\s+/);
  if (words.length >= 2) {
    return words.slice(1, 3).join(' ');
  }
  
  return null;
}

/**
 * Calcule un score de qualité pour un titre (0-100)
 */
function calculateTitleScore(title, product) {
  if (!title || title.trim() === '') return 0;
  
  let score = 0;
  
  // 1. Longueur optimale (30 points)
  const length = title.length;
  if (length >= 50 && length <= 150) {
    score += 30;
  } else if (length >= 30 && length < 50) {
    score += 20;
  } else if (length > 150) {
    score += 10; // Pénalité pour trop long
  } else {
    score += 5; // Trop court
  }
  
  // 2. Marque présente (20 points)
  const brand = product.brand || product.customfields?.brand;
  if (brand && title.toLowerCase().includes(brand.toLowerCase())) {
    score += 20;
  }
  
  // 3. Attributs clés présents (30 points)
  let attributesFound = 0;
  if (product.customfields?.color && title.toLowerCase().includes(product.customfields.color.toLowerCase())) {
    attributesFound++;
  }
  if (product.customfields?.size && title.includes(product.customfields.size)) {
    attributesFound++;
  }
  if (product.customfields?.material && title.toLowerCase().includes(product.customfields.material.toLowerCase())) {
    attributesFound++;
  }
  if (product.customfields?.gender && (title.toLowerCase().includes('homme') || title.toLowerCase().includes('femme') || title.toLowerCase().includes(product.customfields.gender.toLowerCase()))) {
    attributesFound++;
  }
  score += Math.min(attributesFound * 10, 30);
  
  // 4. Structure propre (20 points)
  // Pas de keyword stuffing
  const words = title.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  if (repetitionRatio > 0.8) {
    score += 20; // Peu de répétitions = bon
  } else if (repetitionRatio > 0.6) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

/**
 * Optimise plusieurs titres en batch (économie de coûts)
 */
async function optimizeTitlesBatch(prisma, products, options = {}) {
  const results = [];
  
  // Grouper par industrie pour optimiser les appels
  const byIndustry = {};
  for (const product of products) {
    const industry = options.industry || detectIndustry(product);
    if (!byIndustry[industry]) {
      byIndustry[industry] = [];
    }
    byIndustry[industry].push(product);
  }
  
  // Traiter chaque groupe
  for (const [industry, groupProducts] of Object.entries(byIndustry)) {
    for (const product of groupProducts) {
      try {
        const result = await optimizeTitleWithAI(prisma, product, { ...options, industry });
        results.push({
          productId: product.id,
          success: true,
          ...result
        });
      } catch (error) {
        console.error(`Erreur optimisation titre ${product.id}:`, error);
        results.push({
          productId: product.id,
          success: false,
          error: error.message,
          originalTitle: product.title
        });
      }
    }
  }
  
  return {
    total: products.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    cached: results.filter(r => r.cached).length,
    totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
    results: results
  };
}

module.exports = {
  optimizeTitleWithAI,
  optimizeTitleWithRules,
  optimizeTitlesBatch,
  detectIndustry,
  calculateTitleScore,
  INDUSTRY_TEMPLATES,
  PLATFORM_LIMITS
};
