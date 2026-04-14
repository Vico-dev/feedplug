const crypto = require('crypto');

/**
 * Vérifie si un champ est rempli
 */
function isFieldFilled(item, fieldName, customFields = {}) {
  // Essayer plusieurs variantes du nom du champ
  const value = item[fieldName] || 
                item[fieldName.toLowerCase()] || 
                item[fieldName.toUpperCase()] ||
                customFields[fieldName] || 
                customFields[fieldName.toLowerCase()] || 
                customFields[fieldName.toUpperCase()];
  if (value === null || value === undefined) return false;
  const strValue = String(value).trim();
  return strValue !== '' && strValue !== 'null' && strValue !== 'undefined';
}

/**
 * Calcule la qualité d'un titre (longueur, mots-clés, etc.)
 */
function calculateTitleQuality(title) {
  if (!title || typeof title !== 'string') return 0;
  
  const trimmed = title.trim();
  if (trimmed.length === 0) return 0;
  
  let score = 0;

  // Longueur optimale (50-60 caractères pour Google Merchant Center)
  if (trimmed.length >= 30 && trimmed.length <= 60) {
    score += 0.4;
  } else if (trimmed.length >= 20 && trimmed.length <= 70) {
    score += 0.3;
  } else if (trimmed.length >= 10 && trimmed.length <= 100) {
    score += 0.2;
  } else {
    score += 0.1;
  }

  // Nombre de mots (optimal: 5-10 mots)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 5 && wordCount <= 10) {
    score += 0.3;
  } else if (wordCount >= 3 && wordCount <= 15) {
    score += 0.2;
  } else {
    score += 0.1;
  }
  
  // Présence de caractères spéciaux (à éviter)
  if (!/[<>{}[\]\\]/.test(trimmed)) {
    score += 0.1;
  }

  // Pas de répétition excessive
  const words = trimmed.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (uniqueWords.size / words.length >= 0.7) {
    score += 0.2;
  } else {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Calcule la qualité d'une description
 */
function calculateDescriptionQuality(description) {
  if (!description || typeof description !== 'string') return 0;
  
  const trimmed = description.trim();
  if (trimmed.length === 0) return 0;
  
  let score = 0;

  // Longueur optimale (500-1000 caractères)
  if (trimmed.length >= 500 && trimmed.length <= 1000) {
    score += 0.4;
  } else if (trimmed.length >= 300 && trimmed.length <= 1500) {
    score += 0.3;
  } else if (trimmed.length >= 100 && trimmed.length <= 2000) {
    score += 0.2;
  } else {
    score += 0.1;
  }

  // Nombre de phrases (optimal: 3-5 phrases)
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 3 && sentences.length <= 5) {
    score += 0.3;
  } else if (sentences.length >= 2 && sentences.length <= 7) {
    score += 0.2;
  } else {
    score += 0.1;
  }

  // Pas de HTML excessif
  const htmlTagCount = (trimmed.match(/<[^>]+>/g) || []).length;
  if (htmlTagCount <= 5) {
    score += 0.2;
  } else if (htmlTagCount <= 10) {
    score += 0.1;
  }
  
  // Présence de mots-clés descriptifs
  const descriptiveWords = ['caractéristique', 'fonction', 'avantage', 'bénéfice', 'qualité', 'matériau', 'dimension'];
  const hasDescriptiveWords = descriptiveWords.some(word => trimmed.toLowerCase().includes(word));
  if (hasDescriptiveWords) {
    score += 0.1;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Calcule la qualité d'une image (basé sur l'URL)
 */
function calculateImageQuality(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return 0;
  
  const trimmed = imageUrl.trim();
  if (trimmed.length === 0) return 0;
  
  let score = 0.5; // Base: image présente
  
  // URL valide
  try {
    new URL(trimmed);
    score += 0.3;
  } catch (e) {
    return 0.2; // URL invalide
  }
  
  // Format d'image valide
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const hasValidExtension = validExtensions.some(ext => trimmed.toLowerCase().includes(ext));
  if (hasValidExtension) {
    score += 0.2;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Calcule la qualité d'un prix
 */
function calculatePriceQuality(price) {
  if (price === null || price === undefined) return 0;
  
  const numPrice = typeof price === 'number' ? price : parseFloat(String(price));
  if (isNaN(numPrice)) return 0;
  
  // Prix valide (positif et raisonnable)
  if (numPrice > 0 && numPrice < 1000000) {
    return 1.0;
  }
  
  return 0.5;
}

/**
 * Calcule le score de qualité d'un produit
 */
function calculateQualityScore(item, customFields = {}) {
  const required = {};
  const recommended = {};
  
  // Normaliser les données de l'item (gérer les noms en minuscules depuis PostgreSQL)
  const normalizedItem = {
    title: item.title,
    descriptionText: item.descriptionText || item.descriptiontext,
    descriptionHtml: item.descriptionHtml || item.descriptionhtml,
    description: item.description || item.descriptionText || item.descriptiontext || item.descriptionHtml || item.descriptionhtml,
    imageUrl: item.imageUrl || item.imageurl,
    price: item.price !== null && item.price !== undefined ? (typeof item.price === 'number' ? item.price : Number(item.price)) : null,
    brand: item.brand,
    sku: item.sku,
    gtin: item.gtin,
    mpn: item.mpn,
    condition: item.condition
  };
  
  // Champs obligatoires
  const title = normalizedItem.title || customFields.title || customFields.Title || '';
  const titleFilled = isFieldFilled(normalizedItem, 'title', customFields);
  required.title = {
    filled: titleFilled,
    weight: 0.3,
    quality: titleFilled ? calculateTitleQuality(title) : 0
  };
  
  const description = normalizedItem.description || 
                     normalizedItem.descriptionText || 
                     normalizedItem.descriptionHtml ||
                     customFields.description || customFields.Description || '';
  const descriptionFilled = isFieldFilled(normalizedItem, 'description', customFields) || 
                           isFieldFilled(normalizedItem, 'descriptionText', customFields) ||
                           isFieldFilled(normalizedItem, 'descriptionHtml', customFields) ||
                           (description && description.trim().length > 0);
  required.description = {
    filled: descriptionFilled,
    weight: 0.25,
    quality: descriptionFilled ? calculateDescriptionQuality(description) : 0
  };
  
  const imageUrl = normalizedItem.imageUrl || customFields.imageUrl || customFields.image || '';
  const imageFilled = isFieldFilled(normalizedItem, 'imageUrl', customFields) || (imageUrl && imageUrl.trim().length > 0);
  required.image = {
    filled: imageFilled,
    weight: 0.25,
    quality: imageFilled ? calculateImageQuality(imageUrl) : 0
  };
  
  const price = normalizedItem.price !== null && normalizedItem.price !== undefined ? normalizedItem.price : (customFields.price || customFields.Price);
  const priceFilled = price !== null && price !== undefined && !isNaN(Number(price));
  required.price = {
    filled: priceFilled,
    weight: 0.2,
    quality: priceFilled ? calculatePriceQuality(price) : 0
  };

  // Champs recommandés
  const brand = normalizedItem.brand || customFields.brand || customFields.Brand;
  recommended.brand = {
    filled: isFieldFilled(normalizedItem, 'brand', customFields),
    weight: 0.15
  };

  // GTIN, MPN, Condition (peuvent être dans customFields ou directement dans item)
  const gtin = normalizedItem.gtin || customFields.gtin || customFields.GTIN;
  recommended.gtin = {
    filled: isFieldFilled(normalizedItem, 'gtin', customFields),
    weight: 0.15
  };
  
  const mpn = normalizedItem.mpn || customFields.mpn || customFields.MPN;
  recommended.mpn = {
    filled: isFieldFilled(normalizedItem, 'mpn', customFields),
    weight: 0.1
  };
  
  const condition = normalizedItem.condition || customFields.condition || customFields.Condition;
  recommended.condition = {
    filled: isFieldFilled(normalizedItem, 'condition', customFields),
    weight: 0.1
  };

  // Calcul du score global
  let totalScore = 0;
  let totalWeight = 0;
  
  // Score des champs obligatoires
  Object.values(required).forEach(field => {
    if (field.filled) {
      totalScore += field.quality * field.weight;
    }
    totalWeight += field.weight;
  });
  
  // Bonus pour les champs recommandés (10% max)
  let recommendedScore = 0;
  let recommendedWeight = 0;
  Object.values(recommended).forEach(field => {
    if (field.filled) {
      recommendedScore += field.weight;
    }
    recommendedWeight += field.weight;
  });
  
  if (recommendedWeight > 0) {
    const recommendedBonus = (recommendedScore / recommendedWeight) * 0.1; // Max 10% bonus
    totalScore += recommendedBonus;
  }
  
  // Normaliser le score (0-100)
  const normalizedScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

  return {
    qualityScore: Math.min(Math.max(normalizedScore, 0), 100),
    qualityDetails: {
      required,
      recommended,
      filledFields: [
        ...Object.entries(required).filter(([_, data]) => data.filled).map(([key]) => key),
        ...Object.entries(recommended).filter(([_, data]) => data.filled).map(([key]) => key)
      ]
    }
  };
}

/**
 * Met à jour ou crée le score de qualité pour un item
 */
async function updateQualityScore(prisma, itemId, item, customColumns = []) {
  try {
    // Construire customFields à partir de customColumns
    const customFields = {};
    if (item.customFields && typeof item.customFields === 'object') {
      Object.assign(customFields, item.customFields);
    }
    
    // Ajouter les colonnes personnalisées
    customColumns.forEach(col => {
      if (item[col.name]) {
        customFields[col.name] = item[col.name];
      }
    });
    
    // Calculer le score
    const scoreData = calculateQualityScore(item, customFields);

    // Vérifier si un score existe déjà
    const existingScore = await prisma.$queryRawUnsafe(`
      SELECT * FROM "ProductScore" WHERE itemid = $1::text
    `, itemId);
    
    const now = new Date().toISOString();
    
    if (existingScore && existingScore.length > 0) {
      // Mettre à jour
      await prisma.$executeRawUnsafe(`
        UPDATE "ProductScore" 
        SET qualityscore = $1::int, qualitydetails = $2::jsonb, updatedat = $3::timestamptz
        WHERE itemid = $4::text
      `, scoreData.qualityScore, JSON.stringify(scoreData.qualityDetails), now, itemId);
    } else {
      // Créer
      const scoreId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ProductScore" (id, itemid, qualityscore, qualitydetails, createdat, updatedat)
        VALUES ($1::text, $2::text, $3::int, $4::jsonb, $5::timestamptz, $6::timestamptz)
      `, scoreId, itemId, scoreData.qualityScore, JSON.stringify(scoreData.qualityDetails), now, now);
    }
    
    return scoreData;
  } catch (error) {
    console.error('Error updating quality score:', error);
    throw error;
  }
}

/**
 * Récupère le score de qualité pour un item
 */
async function getQualityScore(prisma, itemId) {
  try {
    const scores = await prisma.$queryRawUnsafe(`
      SELECT * FROM "ProductScore" WHERE itemid = $1::text
    `, itemId);
    
    if (scores && scores.length > 0) {
      const score = scores[0];
      return {
        qualityScore: score.qualityscore || 0,
        performanceScore: score.performancescore || 0,
        qualityDetails: score.qualitydetails || {},
        performanceDetails: score.performancedetails || {}
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting quality score:', error);
    return null;
  }
}

module.exports = {
  calculateQualityScore,
  updateQualityScore,
  getQualityScore
};
