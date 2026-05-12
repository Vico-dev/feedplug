/**
 * 📝 Module d'Optimisation des Descriptions Produits avec IA
 * 
 * Génère des descriptions optimisées adaptées par industrie et plateforme
 * avec un rendu plus conforme aux contraintes des canaux.
 * 
 * Features:
 * - 5 templates par industrie
 * - Structure adaptée au canal (GMC = texte factuel, Amazon/Meta = plus éditorial)
 * - Adaptation longueur par plateforme (GMC 5000, Meta 9000, Amazon 2000)
 * - Cache intelligent
 * - Mots-clés SEO naturels
 * - Bénéfices émotionnels + techniques
 */

const { callAIWithCache } = require('../ai/ai-wrapper');
const { detectIndustry } = require('./title-optimizer');
const { GMC_DESCRIPTION_RULES, applyGmcDescriptionPostCheck } = require('./gmc-guidelines');
const {
  buildLocalizationPrompt,
  buildOptimizationTargetCacheKey,
  resolveOptimizationTarget,
} = require('./destination-prompt-context');

// Limites de caractères par plateforme pour descriptions
const DESCRIPTION_LIMITS = {
  GMC: 5000,
  META: 9000,
  AMAZON: 2000,
  CHATGPT: 5000,
  PINTEREST: 500,
  TIKTOK: 300
};

// Conseils par plateforme (style de description)
const PLATFORM_DESC_HINTS = {
  GMC: 'Style Google Merchant Center : texte brut, factuel, facile à scanner, sans symboles décoratifs.',
  META: 'Style Meta : storytelling, émotionnel, inspire l\'envie. Ton accrocheur et engageant.',
  AMAZON: 'Style Amazon : bénéfices clients, bullet points A9, mots-clés acheteurs, caractéristiques techniques.',
  CHATGPT: 'Style ChatGPT/LLM : factuel, structuré, informatif. Idéal pour la découverte par assistant IA.'
};

// Templates de prompts descriptions par industrie
const INDUSTRY_DESC_TEMPLATES = {
  fashion: {
    name: 'Mode & Accessoires',
    systemPrompt: `Tu es un copywriter expert en e-commerce mode et Google Merchant Center.
Tu génères des descriptions produits optimisées qui convertissent.`,
    userPromptTemplate: (product, targetLength) => `Génère une description optimisée pour ce vêtement/accessoire :

Informations produit :
- Titre : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Matière : ${product.customfields?.material || 'Non spécifié'}
- Couleur : ${product.customfields?.color || 'Non spécifié'}
- Taille : ${product.customfields?.size || 'Non spécifié'}
- Genre : ${product.customfields?.gender || 'Non spécifié'}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}
- Description actuelle : ${(product.descriptiontext || product.descriptionText || '').substring(0, 300)}

Structure OBLIGATOIRE :
1. **Phrase d'accroche** (1 ligne qui vend le bénéfice principal)

2. **Caractéristiques clés** (3-5 bullet points avec ✓)
   ✓ Matière et qualité
   ✓ Coupe et style
   ✓ Couleur et finitions
   ✓ Occasions d'usage
   ✓ Entretien (si pertinent)

3. **Paragraphe détaillé** (100-200 mots)
   - Contexte d'utilisation
   - Détails techniques (composition, fabrication)
   - Avantages produit
   - Conseil de style si pertinent

Règles strictes :
- Longueur cible : ${targetLength} caractères (flexible ±10%)
- Ton : ${getDefaultTone(product)} (adapté au prix et à la marque)
- Mots-clés SEO naturels (matière, style, occasion)
- Pas de keyword stuffing
- Véridique (si info manquante, ne pas inventer)
- Format markdown simple (gras **, listes)

Réponds UNIQUEMENT avec la description optimisée, sans préfixe ni explication.`
  },
  
  beauty: {
    name: 'Beauté & Santé',
    systemPrompt: `Tu es un copywriter expert en e-commerce beauté/cosmétique et Google Merchant Center.
Tu génères des descriptions produits qui rassurent et convertissent.`,
    userPromptTemplate: (product, targetLength) => `Génère une description optimisée pour ce produit beauté :

Informations produit :
- Titre : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Volume : ${product.customfields?.size || 'Non spécifié'}
- Description actuelle : ${(product.descriptiontext || product.descriptionText || '').substring(0, 400)}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Structure OBLIGATOIRE :
1. **Phrase d'accroche** (Bénéfice principal pour la peau/cheveux)

2. **Bénéfices clés** (4-6 bullet points avec ✓)
   ✓ Action principale (hydrate, nourrit, répare...)
   ✓ Type de peau/cheveux
   ✓ Ingrédients stars
   ✓ Texture et application
   ✓ Résultats attendus
   ✓ Certifications (bio, vegan, cruelty-free, dermato testé)

3. **Paragraphe détaillé** (150-250 mots)
   - Formulation et ingrédients actifs
   - Mode d'application
   - Résultats visibles et délai
   - Convient à quel type de peau/cheveux
   - Origine/fabrication si pertinent

Règles strictes :
- Longueur cible : ${targetLength} caractères (flexible ±10%)
- Ton rassurant et expert
- Mots-clés beauté (hydratant, anti-âge, naturel, bio)
- Pas de claims santé non prouvés
- Mentionner allergènes si pertinent
- Format markdown simple

Réponds UNIQUEMENT avec la description optimisée, sans préfixe ni explication.`
  },
  
  tech: {
    name: 'High-Tech & Électronique',
    systemPrompt: `Tu es un copywriter expert en e-commerce high-tech et Google Merchant Center.
Tu génères des descriptions techniques précises qui convertissent.`,
    userPromptTemplate: (product, targetLength) => `Génère une description optimisée pour ce produit tech :

Informations produit :
- Titre : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Modèle : ${product.mpn || product.customfields?.mpn || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Description actuelle : ${(product.descriptiontext || product.descriptionText || '').substring(0, 400)}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Structure OBLIGATOIRE :
1. **Phrase d'accroche** (Positionnement produit en 1 ligne)

2. **Spécifications techniques** (5-7 bullet points avec ✓)
   ✓ Processeur/Puce (si applicable)
   ✓ Mémoire/Stockage
   ✓ Écran/Affichage
   ✓ Batterie/Autonomie
   ✓ Connectivité
   ✓ Dimensions et poids
   ✓ Garantie

3. **Paragraphe détaillé** (150-250 mots)
   - Performances et cas d'usage
   - Fonctionnalités principales
   - Compatibilité (OS, accessoires)
   - Points forts vs concurrence
   - Contenu de la boîte

Règles strictes :
- Longueur cible : ${targetLength} caractères (flexible ±10%)
- Ton technique mais accessible
- Specs précises et vérifiables
- Pas de superlatifs marketing ("le meilleur")
- Pas d'inventions techniques
- Format markdown simple

Réponds UNIQUEMENT avec la description optimisée, sans préfixe ni explication.`
  },
  
  food: {
    name: 'Alimentaire & Boissons',
    systemPrompt: `Tu es un copywriter expert en e-commerce alimentaire et Google Merchant Center.
Tu génères des descriptions appétissantes et conformes aux régulations.`,
    userPromptTemplate: (product, targetLength) => `Génère une description optimisée pour ce produit alimentaire :

Informations produit :
- Titre : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Poids/Volume : ${product.customfields?.size || 'Non spécifié'}
- Description actuelle : ${(product.descriptiontext || product.descriptionText || '').substring(0, 400)}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Structure OBLIGATOIRE :
1. **Phrase d'accroche** (Appétissante et valorisante)

2. **Points clés** (4-6 bullet points avec ✓)
   ✓ Type de produit et usage
   ✓ Ingrédients principaux ou composition
   ✓ Origine/Fabrication
   ✓ Certifications (Bio, Label Rouge, AOC, etc.)
   ✓ Valeurs nutritionnelles si pertinent
   ✓ Allergènes ou "Sans" (gluten, lactose, etc.)

3. **Paragraphe détaillé** (100-200 mots)
   - Saveurs et caractéristiques gustatives
   - Procédé de fabrication si valorisant
   - Conseils de dégustation/utilisation
   - Conservation et DLC si pertinent
   - Origine et histoire si intéressante

Règles strictes :
- Longueur cible : ${targetLength} caractères (flexible ±10%)
- Ton gourmand mais informatif
- Mention OBLIGATOIRE des allergènes si présents
- Pas de claims santé non autorisés
- Ingrédients véridiques seulement
- Format markdown simple

Réponds UNIQUEMENT avec la description optimisée, sans préfixe ni explication.`
  },
  
  home: {
    name: 'Maison & Déco',
    systemPrompt: `Tu es un copywriter expert en e-commerce maison/décoration et Google Merchant Center.
Tu génères des descriptions inspirantes qui projettent dans un intérieur.`,
    userPromptTemplate: (product, targetLength) => `Génère une description optimisée pour ce produit maison/déco :

Informations produit :
- Titre : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Matière : ${product.customfields?.material || 'Non spécifié'}
- Dimensions : ${product.customfields?.size || 'Non spécifié'}
- Couleur : ${product.customfields?.color || 'Non spécifié'}
- Description actuelle : ${(product.descriptiontext || product.descriptionText || '').substring(0, 400)}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Structure OBLIGATOIRE :
1. **Phrase d'accroche** (Projection dans l'intérieur)

2. **Caractéristiques** (4-6 bullet points avec ✓)
   ✓ Matériaux et qualité
   ✓ Dimensions précises
   ✓ Style/Design (Scandinave, Industriel, etc.)
   ✓ Couleurs et finitions
   ✓ Utilisation et placement
   ✓ Entretien

3. **Paragraphe détaillé** (100-200 mots)
   - Ambiance et style créé
   - Qualité de fabrication
   - Praticité et fonctionnalités
   - Associations déco possibles
   - Durabilité

Règles strictes :
- Longueur cible : ${targetLength} caractères (flexible ±10%)
- Ton inspirant mais informatif
- Dimensions précises et vérifiables
- Style déco mentionné
- Pas d'exagérations
- Format markdown simple

Réponds UNIQUEMENT avec la description optimisée, sans préfixe ni explication.`
  },
  
  general: {
    name: 'Général',
    systemPrompt: `Tu es un copywriter expert en e-commerce et Google Merchant Center.
Tu génères des descriptions produits optimisées qui convertissent.`,
    userPromptTemplate: (product, targetLength) => `Génère une description optimisée pour ce produit :

Informations produit :
- Titre : ${product.title || 'Non spécifié'}
- Marque : ${product.brand || product.customfields?.brand || 'Non spécifié'}
- Type : ${product.customfields?.product_type || 'Non spécifié'}
- Catégorie : ${product.customfields?.google_product_category || 'Non spécifié'}
- Description actuelle : ${(product.descriptiontext || product.descriptionText || '').substring(0, 400)}
- Prix : ${product.price || 'Non spécifié'} ${product.currency || 'EUR'}

Structure OBLIGATOIRE :
1. **Phrase d'accroche** (Bénéfice principal)

2. **Points clés** (4-5 bullet points avec ✓)
   ✓ Caractéristique 1
   ✓ Caractéristique 2
   ✓ Bénéfice 1
   ✓ Bénéfice 2
   ✓ Utilisation

3. **Paragraphe détaillé** (100-200 mots)
   - Détails techniques
   - Avantages produit
   - Utilisation recommandée
   - Qualité et garanties

Règles strictes :
- Longueur cible : ${targetLength} caractères (flexible ±10%)
- Ton professionnel et clair
- Mots-clés SEO naturels
- Pas de keyword stuffing
- Véridique uniquement
- Format markdown simple

Réponds UNIQUEMENT avec la description optimisée, sans préfixe ni explication.`
  }
};

// Helper : Déterminer la tonalité selon le prix
function getDefaultTone(product) {
  const price = parseFloat(product.price || 0);
  if (price > 500) return 'Luxe et raffiné';
  if (price > 100) return 'Premium et qualitatif';
  if (price > 30) return 'Accessible et moderne';
  return 'Grand public et pratique';
}

function getProductFacts(product) {
  const customFields = product.customfields || product.customFields || {};
  const description = (product.descriptiontext || product.descriptionText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const factEntries = [
    ['Titre', product.title],
    ['Marque', product.brand || customFields.brand],
    ['Type', customFields.product_type],
    ['Catégorie Google', customFields.google_product_category],
    ['Couleur', customFields.color],
    ['Matière', customFields.material],
    ['Taille / dimensions', customFields.size || customFields.dimensions],
    ['Capacité', customFields.capacity],
    ['Puissance', customFields.power || customFields.wattage],
    ['Compatibilité', customFields.compatibility],
    ['Condition', product.condition],
    ['GTIN', product.gtin],
    ['MPN', product.mpn || customFields.mpn],
    ['Description actuelle', description ? description.substring(0, 500) : null],
  ];

  return factEntries
    .filter(([, value]) => typeof value === 'string' ? value.trim().length > 0 : Boolean(value))
    .map(([label, value]) => `- ${label} : ${String(value).trim()}`)
    .join('\n');
}

function buildGmcDescriptionPrompt(product, targetLength) {
  return `Rédige une description produit pour Google Merchant Center.

Informations produit :
${getProductFacts(product)}

Objectif :
- aider l'acheteur à identifier rapidement le bon produit
- mettre en avant les faits utiles et vérifiables

Format OBLIGATOIRE :
- texte brut uniquement
- 2 ou 3 paragraphes courts
- pas de titres de section
- pas de markdown
- pas de puces, pas de symboles ✓, pas d'emoji
- pas de ton publicitaire

Règles STRICTES :
- viser environ ${targetLength} caractères si l'information disponible le permet
- si possible, rester dans une plage utile de 500 à 1000 caractères
- ouvrir avec l'information produit la plus importante
- décrire la fonction, les attributs clés, les usages concrets, les dimensions/capacités/compatibilités quand elles existent
- ne pas reprendre mot pour mot le titre comme phrase complète
- ne pas mentionner prix, livraison, promotion, SAV, politique magasin, appel à l'action
- ne pas inventer d'informations
- éviter les superlatifs non prouvés

Réponds UNIQUEMENT avec la description finale.`;
}

/**
 * Optimise une description produit avec IA
 */
async function optimizeDescriptionWithAI(prisma, product, options = {}) {
  const platform = options.platform || 'GMC';
  const forceRefresh = options.forceRefresh || false;
  const manualIndustry = options.industry || null;
  const targetContext = resolveOptimizationTarget(options);
  
  // Validation
  if (!product || !product.id) {
    throw new Error('Produit invalide (ID manquant)');
  }
  
  const originalDescription = product.descriptiontext || product.descriptionText || product.descriptionhtml || '';
  
  // Si la description est déjà longue et structurée, peut-être déjà optimale
  if (!forceRefresh && isDescriptionOptimal(originalDescription)) {
    return {
      optimizedDescription: originalDescription,
      originalDescription: originalDescription,
      industry: detectIndustry(product),
      score: 90,
      cached: false,
      skipped: true,
      reason: 'Description déjà optimale'
    };
  }
  
  // Détecter l'industrie
  const industry = manualIndustry || detectIndustry(product);
  const template = INDUSTRY_DESC_TEMPLATES[industry] || INDUSTRY_DESC_TEMPLATES.general;
  
  // Longueur cible selon la plateforme
  const targetLength = DESCRIPTION_LIMITS[platform] || DESCRIPTION_LIMITS.GMC;
  const recommendedLength = Math.min(targetLength * 0.6, 1500); // 60% de la limite max, ou 1500 caractères
  
  // Préparer le prompt avec conseil plateforme
  const platformHint = PLATFORM_DESC_HINTS[platform] || PLATFORM_DESC_HINTS.GMC;
  const systemPrompt = platform === 'GMC'
    ? template.systemPrompt + GMC_DESCRIPTION_RULES
    : template.systemPrompt;
  const baseUserPrompt = platform === 'GMC'
    ? buildGmcDescriptionPrompt(product, recommendedLength)
    : template.userPromptTemplate(product, recommendedLength);
  const userPrompt = `${baseUserPrompt}\n\n[Contexte plateforme] ${platformHint}${buildLocalizationPrompt(targetContext)}\nLimite max : ${targetLength} caractères.`;
  
  try {
    // Appeler l'IA avec cache
    const result = await callAIWithCache(
      prisma,
      'description_optimization',
      {
        productId: product.id,
        title: product.title,
        brand: product.brand || product.customfields?.brand,
        category: product.customfields?.google_product_category,
        industry: industry,
        platform: platform,
        targetLength: recommendedLength,
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
    
    // Nettoyer la description
    let optimizedDescription = cleanDescription(result.text);

    // Conformité GMC : retirer résidus promotionnels / claims non vérifiables
    if (platform === 'GMC') {
      optimizedDescription = applyGmcDescriptionPostCheck(optimizedDescription);
    }

    // Valider la longueur
    if (optimizedDescription.length > targetLength) {
      optimizedDescription = truncateDescription(optimizedDescription, targetLength);
    }
    
    // Calculer le score
    const score = calculateDescriptionScore(optimizedDescription, product);
    
    return {
      optimizedDescription: optimizedDescription,
      originalDescription: originalDescription,
      industry: industry,
      industryName: template.name,
      score: score,
      length: optimizedDescription.length,
      cached: result.cached || false,
      provider: result.provider || 'gemini',
      cost: result.cost || 0,
      improvement: score - calculateDescriptionScore(originalDescription, product)
    };
    
  } catch (error) {
    console.error('Erreur optimisation description IA:', error);
    
    // Fallback : générer une description basique par règles
    console.log('Fallback sur génération par règles basiques');
    return generateDescriptionWithRules(product, platform);
  }
}

/**
 * Génère une description basique par règles (sans IA)
 */
function generateDescriptionWithRules(product, platform = 'GMC') {
  const parts = [];
  
  // Titre comme première phrase
  if (product.title) {
    parts.push(product.title + '.');
  }
  
  // Ajouter les caractéristiques disponibles
  const characteristics = [];
  if (product.brand) characteristics.push(`Marque : ${product.brand}`);
  if (product.customfields?.material) characteristics.push(`Matière : ${product.customfields.material}`);
  if (product.customfields?.color) characteristics.push(`Couleur : ${product.customfields.color}`);
  if (product.customfields?.size) characteristics.push(`Taille : ${product.customfields.size}`);

  if (characteristics.length > 0) {
    if (platform === 'GMC') {
      parts.push('\n\n' + characteristics.join('. ') + '.');
    } else {
      parts.push('\n\nCaractéristiques :');
      characteristics.forEach(char => parts.push(`\n✓ ${char}`));
    }
  }
  
  // Ajouter la description originale si elle existe
  if (product.descriptiontext || product.descriptionText) {
    const original = (product.descriptiontext || product.descriptionText).substring(0, 500);
    parts.push('\n\n' + original);
  }
  
  const description = parts.join('');
  
  return {
    optimizedDescription: description,
    originalDescription: product.descriptiontext || product.descriptionText || '',
    industry: 'general',
    industryName: 'Général',
    score: calculateDescriptionScore(description, product),
    length: description.length,
    cached: false,
    provider: 'rules',
    cost: 0,
    improvement: 0
  };
}

/**
 * Vérifie si une description est déjà optimale
 */
function isDescriptionOptimal(description) {
  if (!description || description.length < 200) return false;
  if (description.length > 5000) return false;
  
  // Vérifier structure : paragraphes ou listes utiles
  const hasBullets = description.includes('✓') || description.includes('•') || description.includes('-');
  const sentenceCount = (description.match(/[.!?](?:\s|$)/g) || []).length;
  const paragraphCount = description.split(/\n{2,}/).filter((entry) => entry.trim().length > 0).length;
  
  // Score rapide
  const score = calculateDescriptionScore(description, {});
  return score >= 80 && (hasBullets || paragraphCount >= 2 || sentenceCount >= 3);
}

/**
 * Nettoie une description générée par l'IA
 */
function cleanDescription(description) {
  if (!description) return '';
  
  // Retirer les guillemets de début/fin
  let cleaned = description.trim().replace(/^["']|["']$/g, '');
  
  // Retirer les préfixes courants
  cleaned = cleaned.replace(/^(Description optimisée|Description|Voici la description):\s*/i, '');
  
  // Normaliser les bullet points simples si présents
  cleaned = cleaned.replace(/^[\*]\s+/gm, '• ');
  
  // Retirer les doubles espaces
  cleaned = cleaned.replace(/\s\s+/g, ' ');
  
  return cleaned.trim();
}

/**
 * Tronque une description intelligemment
 */
function truncateDescription(description, maxLength) {
  if (description.length <= maxLength) return description;
  
  // Tronquer à la dernière phrase complète avant la limite
  const truncated = description.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.85) {
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  } else {
    return truncated.substring(0, maxLength - 3).trim() + '...';
  }
}

/**
 * Calcule un score de qualité pour une description (0-100)
 */
function calculateDescriptionScore(description, product) {
  if (!description || description.trim() === '') return 0;
  
  let score = 0;
  
  // 1. Longueur optimale (25 points)
  const length = description.length;
  if (length >= 500 && length <= 2000) {
    score += 25;
  } else if (length >= 200 && length < 500) {
    score += 15;
  } else if (length > 2000 && length <= 5000) {
    score += 20;
  } else if (length < 200) {
    score += 5;
  }
  
  // 2. Structure avec bullet points (25 points)
  const hasBullets = description.includes('✓') || description.includes('•') || /^[\t ]*-\s+/m.test(description);
  const bulletCount = (description.match(/[✓•]/g) || []).length + (description.match(/^[\t ]*-\s+/gm) || []).length;
  const sentenceCount = (description.match(/[.!?](?:\s|$)/g) || []).length;
  const paragraphCount = description.split(/\n{2,}/).filter((entry) => entry.trim().length > 0).length;
  let structureScore = 0;
  if (hasBullets) {
    if (bulletCount >= 3 && bulletCount <= 8) {
      structureScore = 25;
    } else if (bulletCount > 0) {
      structureScore = 15;
    }
  }
  if (paragraphCount >= 2 || sentenceCount >= 4) {
    structureScore = Math.max(structureScore, 25);
  } else if (sentenceCount >= 2) {
    structureScore = Math.max(structureScore, 15);
  }
  score += structureScore;
  
  // 3. Marque mentionnée (15 points)
  const brand = product.brand || product.customfields?.brand;
  if (brand && description.toLowerCase().includes(brand.toLowerCase())) {
    score += 15;
  }
  
  // 4. Mots-clés pertinents (20 points)
  const keywords = [
    product.customfields?.color,
    product.customfields?.material,
    product.customfields?.size,
    product.customfields?.product_type
  ].filter(Boolean);
  
  let keywordsFound = 0;
  for (const keyword of keywords) {
    if (description.toLowerCase().includes(keyword.toLowerCase())) {
      keywordsFound++;
    }
  }
  score += Math.min(keywordsFound * 5, 20);
  
  // 5. Pas de keyword stuffing (15 points)
  const words = description.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  if (repetitionRatio > 0.7) {
    score += 15;
  } else if (repetitionRatio > 0.5) {
    score += 8;
  }
  
  return Math.min(score, 100);
}

/**
 * Optimise plusieurs descriptions en batch
 */
async function optimizeDescriptionsBatch(prisma, products, options = {}) {
  const results = [];
  
  for (const product of products) {
    try {
      const result = await optimizeDescriptionWithAI(prisma, product, options);
      results.push({
        productId: product.id,
        success: true,
        ...result
      });
    } catch (error) {
      console.error(`Erreur optimisation description ${product.id}:`, error);
      results.push({
        productId: product.id,
        success: false,
        error: error.message,
        originalDescription: product.descriptiontext || product.descriptionText || ''
      });
    }
  }
  
  return {
    total: products.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    cached: results.filter(r => r.cached).length,
    totalCost: results.reduce((sum, r) => sum + (r.cost || 0), 0),
    averageScore: results.filter(r => r.success).reduce((sum, r) => sum + r.score, 0) / results.filter(r => r.success).length,
    results: results
  };
}

module.exports = {
  optimizeDescriptionWithAI,
  generateDescriptionWithRules,
  optimizeDescriptionsBatch,
  calculateDescriptionScore,
  DESCRIPTION_LIMITS,
  INDUSTRY_DESC_TEMPLATES
};
