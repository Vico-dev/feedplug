const crypto = require('crypto');

/**
 * Vérifie si un champ est rempli (avec variantes de casse)
 */
function isFieldFilled(item, fieldName, customFields = {}) {
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
 * Récupère la valeur d'un champ (avec variantes)
 */
function getFieldValue(item, fieldName, customFields = {}) {
  if (!item || !fieldName) return null;
  
  // Essayer dans item
  if (item[fieldName] !== undefined && item[fieldName] !== null && item[fieldName] !== '') {
    return item[fieldName];
  }
  if (item[fieldName.toLowerCase()] !== undefined && item[fieldName.toLowerCase()] !== null && item[fieldName.toLowerCase()] !== '') {
    return item[fieldName.toLowerCase()];
  }
  if (item[fieldName.toUpperCase()] !== undefined && item[fieldName.toUpperCase()] !== null && item[fieldName.toUpperCase()] !== '') {
    return item[fieldName.toUpperCase()];
  }
  
  // Essayer dans customFields
  if (customFields && typeof customFields === 'object') {
    if (customFields[fieldName] !== undefined && customFields[fieldName] !== null && customFields[fieldName] !== '') {
      return customFields[fieldName];
    }
    if (customFields[fieldName.toLowerCase()] !== undefined && customFields[fieldName.toLowerCase()] !== null && customFields[fieldName.toLowerCase()] !== '') {
      return customFields[fieldName.toLowerCase()];
    }
    if (customFields[fieldName.toUpperCase()] !== undefined && customFields[fieldName.toUpperCase()] !== null && customFields[fieldName.toUpperCase()] !== '') {
      return customFields[fieldName.toUpperCase()];
    }
  }
  
  return null;
}

/**
 * DIMENSION 1: CONFORMITÉ GMC (0-100)
 * Vérifie que le produit respecte les exigences minimales de Google Merchant Center
 */
function calculateComplianceScore(item, customFields = {}) {
  let score = 0;
  const details = {
    required: {},
    recommended: {},
    issues: []
  };

  // === CHAMPS OBLIGATOIRES (70 points) ===

  // ID (5 points)
  const id = item.id || getFieldValue(item, 'id', customFields);
  if (id) {
    details.required.id = { present: true, score: 5 };
    score += 5;
  } else {
    details.required.id = { present: false, score: 0 };
    details.issues.push({ field: 'id', severity: 'blocking', message: 'ID manquant - produit sera rejeté' });
  }

  // Title (15 points)
  const title = getFieldValue(item, 'title', customFields);
  if (title) {
    let titleScore = 5; // Présence
    const titleStr = String(title).trim();
    
    // Longueur valide (1-150 caractères)
    if (titleStr.length >= 1 && titleStr.length <= 150) {
      titleScore += 3;
    } else {
      details.issues.push({ field: 'title', severity: 'error', message: `Longueur invalide: ${titleStr.length} caractères (max 150)` });
    }
    
    // Pas de caractères interdits
    if (!/[<>{}[\]\\]/.test(titleStr)) {
      titleScore += 2;
    } else {
      details.issues.push({ field: 'title', severity: 'error', message: 'Caractères interdits détectés' });
    }
    
    // Pas de contenu promotionnel (détection basique)
    const promotionalWords = ['gratuit', 'livraison gratuite', 'promo', 'réduction', 'offre spéciale', 'limited time'];
    const hasPromotional = promotionalWords.some(word => titleStr.toLowerCase().includes(word));
    if (!hasPromotional) {
      titleScore += 5;
    } else {
      details.issues.push({ field: 'title', severity: 'warning', message: 'Contenu promotionnel détecté dans le titre' });
    }
    
    details.required.title = { present: true, score: titleScore, length: titleStr.length };
    score += titleScore;
  } else {
    details.required.title = { present: false, score: 0 };
    details.issues.push({ field: 'title', severity: 'blocking', message: 'Titre manquant - produit sera rejeté' });
  }

  // Description (12 points)
  const description = getFieldValue(item, 'description', customFields) || 
                     getFieldValue(item, 'descriptionText', customFields) ||
                     getFieldValue(item, 'descriptionHtml', customFields);
  if (description) {
    let descScore = 4; // Présence
    const descStr = String(description).trim();
    
    // Longueur valide (1-5000 caractères)
    if (descStr.length >= 1 && descStr.length <= 5000) {
      descScore += 3;
    } else {
      details.issues.push({ field: 'description', severity: 'error', message: `Longueur invalide: ${descStr.length} caractères (max 5000)` });
    }
    
    // Pas de HTML invalide (détection basique)
    const htmlTagCount = (descStr.match(/<[^>]+>/g) || []).length;
    if (htmlTagCount <= 20) {
      descScore += 3;
    } else {
      details.issues.push({ field: 'description', severity: 'warning', message: 'Trop de balises HTML' });
    }
    
    // Pas de liens externes (détection basique)
    const externalLinks = (descStr.match(/https?:\/\/(?!yourdomain\.com)/gi) || []).length;
    if (externalLinks === 0) {
      descScore += 2;
    } else {
      details.issues.push({ field: 'description', severity: 'warning', message: 'Liens externes détectés' });
    }
    
    details.required.description = { present: true, score: descScore, length: descStr.length };
    score += descScore;
  } else {
    details.required.description = { present: false, score: 0 };
    details.issues.push({ field: 'description', severity: 'blocking', message: 'Description manquante - produit sera rejeté' });
  }

  // Image Link (12 points)
  const imageUrl = getFieldValue(item, 'imageUrl', customFields) || 
                   getFieldValue(item, 'image_link', customFields) ||
                   getFieldValue(item, 'imageurl', customFields);
  if (imageUrl) {
    let imageScore = 4; // Présence
    const imageStr = String(imageUrl).trim();
    
    // URL valide (HTTPS)
    try {
      const url = new URL(imageStr);
      if (url.protocol === 'https:') {
        imageScore += 3;
      } else {
        details.issues.push({ field: 'image', severity: 'error', message: 'URL doit être en HTTPS' });
      }
    } catch (e) {
      details.issues.push({ field: 'image', severity: 'error', message: 'URL invalide' });
    }
    
    // Format supporté
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const hasValidExtension = validExtensions.some(ext => imageStr.toLowerCase().includes(ext));
    if (hasValidExtension) {
      imageScore += 3;
    } else {
      details.issues.push({ field: 'image', severity: 'warning', message: 'Format d\'image non recommandé' });
    }
    
    // Accessibilité (on assume que c'est accessible, vérification réelle nécessiterait un appel HTTP)
    imageScore += 2; // On donne le bénéfice du doute
    
    details.required.image = { present: true, score: imageScore, url: imageStr };
    score += imageScore;
  } else {
    details.required.image = { present: false, score: 0 };
    details.issues.push({ field: 'image', severity: 'blocking', message: 'Image manquante - produit sera rejeté' });
  }

  // Price (10 points)
  const price = item.price !== null && item.price !== undefined ? item.price : getFieldValue(item, 'price', customFields);
  if (price !== null && price !== undefined) {
    let priceScore = 4; // Présence
    const numPrice = typeof price === 'number' ? price : parseFloat(String(price));
    
    // Format valide (nombre positif)
    if (!isNaN(numPrice) && numPrice > 0) {
      priceScore += 3;
    } else {
      details.issues.push({ field: 'price', severity: 'error', message: 'Prix invalide ou négatif' });
    }
    
    // Devise présente
    const currency = item.currency || getFieldValue(item, 'currency', customFields);
    if (currency) {
      priceScore += 3;
    } else {
      details.issues.push({ field: 'price', severity: 'warning', message: 'Devise manquante' });
    }
    
    details.required.price = { present: true, score: priceScore, value: numPrice, currency: currency || null };
    score += priceScore;
  } else {
    details.required.price = { present: false, score: 0 };
    details.issues.push({ field: 'price', severity: 'blocking', message: 'Prix manquant - produit sera rejeté' });
  }

  // Availability (8 points)
  const availability = getFieldValue(item, 'availability', customFields);
  const validAvailabilities = ['in stock', 'out of stock', 'preorder', 'backorder'];
  if (availability) {
    let availScore = 4; // Présence
    const availStr = String(availability).toLowerCase().trim();
    
    if (validAvailabilities.includes(availStr)) {
      availScore += 4;
      if (availStr === 'in stock') {
        availScore += 0; // Bonus déjà compté
      }
    } else {
      details.issues.push({ field: 'availability', severity: 'error', message: `Valeur invalide: ${availability}. Valeurs valides: ${validAvailabilities.join(', ')}` });
    }
    
    details.required.availability = { present: true, score: availScore, value: availStr };
    score += availScore;
  } else {
    details.required.availability = { present: false, score: 0 };
    details.issues.push({ field: 'availability', severity: 'blocking', message: 'Disponibilité manquante - produit sera rejeté' });
  }

  // Condition (6 points)
  const condition = getFieldValue(item, 'condition', customFields);
  const validConditions = ['new', 'refurbished', 'used'];
  if (condition) {
    let condScore = 3; // Présence
    const condStr = String(condition).toLowerCase().trim();
    
    if (validConditions.includes(condStr)) {
      condScore += 3;
    } else {
      details.issues.push({ field: 'condition', severity: 'error', message: `Valeur invalide: ${condition}. Valeurs valides: ${validConditions.join(', ')}` });
    }
    
    details.required.condition = { present: true, score: condScore, value: condStr };
    score += condScore;
  } else {
    details.required.condition = { present: false, score: 0 };
    details.issues.push({ field: 'condition', severity: 'blocking', message: 'Condition manquante - produit sera rejeté' });
  }

  // Link (2 points)
  const link = getFieldValue(item, 'link', customFields) || getFieldValue(item, 'url', customFields);
  if (link) {
    details.required.link = { present: true, score: 2 };
    score += 2;
  } else {
    details.required.link = { present: false, score: 0 };
    details.issues.push({ field: 'link', severity: 'blocking', message: 'Lien produit manquant - produit sera rejeté' });
  }

  // === CHAMPS RECOMMANDÉS (30 points) ===

  // Brand (8 points)
  const brand = getFieldValue(item, 'brand', customFields);
  if (brand) {
    details.recommended.brand = { present: true, score: 8 };
    score += 8;
  } else {
    details.recommended.brand = { present: false, score: 0 };
    details.issues.push({ field: 'brand', severity: 'warning', message: 'Marque manquante - recommandé pour certaines catégories' });
  }

  // GTIN (10 points)
  const gtin = getFieldValue(item, 'gtin', customFields);
  if (gtin) {
    // Validation basique GTIN (13 ou 14 chiffres)
    const gtinStr = String(gtin).replace(/\D/g, '');
    if (gtinStr.length === 13 || gtinStr.length === 14) {
      details.recommended.gtin = { present: true, score: 10, valid: true };
      score += 10;
    } else {
      details.recommended.gtin = { present: true, score: 5, valid: false };
      details.issues.push({ field: 'gtin', severity: 'warning', message: 'Format GTIN invalide (doit être 13 ou 14 chiffres)' });
      score += 5;
    }
  } else {
    details.recommended.gtin = { present: false, score: 0 };
    details.issues.push({ field: 'gtin', severity: 'info', message: 'GTIN manquant - recommandé pour meilleure visibilité' });
  }

  // MPN (5 points)
  const mpn = getFieldValue(item, 'mpn', customFields);
  if (mpn) {
    details.recommended.mpn = { present: true, score: 5 };
    score += 5;
  } else {
    details.recommended.mpn = { present: false, score: 0 };
    if (!gtin) {
      details.issues.push({ field: 'mpn', severity: 'warning', message: 'MPN manquant - obligatoire si pas de GTIN' });
    }
  }

  // Google Product Category (7 points)
  const googleCategory = getFieldValue(item, 'google_product_category', customFields);
  if (googleCategory) {
    // Vérifier si c'est une catégorie précise (niveau 3+)
    const categoryStr = String(googleCategory);
    const depth = (categoryStr.match(/>/g) || []).length;
    const scoreValue = depth >= 2 ? 7 : 4;
    details.recommended.google_product_category = { present: true, score: scoreValue, depth: depth + 1 };
    score += scoreValue;
  } else {
    details.recommended.google_product_category = { present: false, score: 0 };
    details.issues.push({ field: 'google_product_category', severity: 'info', message: 'Catégorie Google manquante - très recommandé pour le ciblage' });
  }

  return {
    score: Math.min(Math.round(score), 100),
    details,
    blocking: details.issues.filter(i => i.severity === 'blocking').length > 0
  };
}

/**
 * DIMENSION 2: QUALITÉ DES DONNÉES (0-100)
 * Évalue la qualité et la richesse des informations produit
 */
function calculateDataQualityScore(item, customFields = {}) {
  let score = 0;
  const details = {};

  // === TITRE (25 points) ===
  const title = getFieldValue(item, 'title', customFields);
  if (title) {
    const titleStr = String(title).trim();
    let titleScore = 0;
    const titleDetails = {};

    // Longueur optimale GMC : 70-130 caractères (max 150)
    if (titleStr.length >= 70 && titleStr.length <= 130) {
      titleScore += 8;
      titleDetails.lengthScore = 8;
      titleDetails.lengthStatus = 'optimal';
    } else if (titleStr.length >= 50 && titleStr.length <= 150) {
      titleScore += 6;
      titleDetails.lengthScore = 6;
      titleDetails.lengthStatus = 'good';
    } else if (titleStr.length >= 30 && titleStr.length <= 150) {
      titleScore += 4;
      titleDetails.lengthScore = 4;
      titleDetails.lengthStatus = 'acceptable';
    } else {
      titleScore += 2;
      titleDetails.lengthScore = 2;
      titleDetails.lengthStatus = 'needs_improvement';
    }
    titleDetails.length = titleStr.length;

    // Structure optimale : 7 points
    let structureScore = 0;
    const words = titleStr.split(/\s+/);
    // Détection basique de la structure [Marque] [Modèle] [Attributs]
    // On assume que les premiers mots sont la marque si brand est présent
    const brand = getFieldValue(item, 'brand', customFields);
    if (brand && titleStr.toLowerCase().startsWith(brand.toLowerCase())) {
      structureScore += 2;
    }
    // Vérifier la présence d'attributs (couleur, taille, etc.)
    const attributeWords = ['rouge', 'bleu', 'noir', 'blanc', 's', 'm', 'l', 'xl', 'petit', 'grand', 'moyen'];
    const hasAttributes = attributeWords.some(word => titleStr.toLowerCase().includes(word));
    if (hasAttributes) {
      structureScore += 2;
    }
    // Ordre logique (au moins 3 mots)
    if (words.length >= 3) {
      structureScore += 1;
    }
    titleScore += structureScore;
    titleDetails.structureScore = structureScore;

    // Mots-clés pertinents : 5 points
    // Détection basique : présence de mots descriptifs
    const descriptiveWords = titleStr.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(descriptiveWords);
    const keywordScore = Math.min(5, (uniqueWords.size / Math.max(1, descriptiveWords.length)) * 5);
    titleScore += keywordScore;
    titleDetails.keywordScore = keywordScore;

    // Lisibilité : 5 points
    let readabilityScore = 0;
    // Pas de majuscules excessives
    const upperCaseRatio = (titleStr.match(/[A-Z]/g) || []).length / Math.max(1, titleStr.length);
    if (upperCaseRatio < 0.3) {
      readabilityScore += 2;
    }
    // Pas de répétitions
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word.toLowerCase()] = (wordCounts[word.toLowerCase()] || 0) + 1;
    });
    const maxRepetition = Math.max(...Object.values(wordCounts));
    if (maxRepetition <= 2) {
      readabilityScore += 2;
    }
    // Séparateurs appropriés
    if (!/[!@#$%^&*()_+=\[\]{}|;:'",<>?\/\\]/.test(titleStr)) {
      readabilityScore += 1;
    }
    titleScore += readabilityScore;
    titleDetails.readabilityScore = readabilityScore;

    details.title = { score: Math.min(titleScore, 25), ...titleDetails };
    score += details.title.score;
  } else {
    details.title = { score: 0 };
  }

  // === DESCRIPTION (25 points) ===
  const description = getFieldValue(item, 'description', customFields) || 
                     getFieldValue(item, 'descriptionText', customFields) ||
                     getFieldValue(item, 'descriptionHtml', customFields);
  if (description) {
    const descStr = String(description).trim();
    let descScore = 0;
    const descDetails = {};

    // Longueur optimale (500-1000 caractères) : 10 points
    if (descStr.length >= 500 && descStr.length <= 1000) {
      descScore += 10;
      descDetails.lengthScore = 10;
      descDetails.lengthStatus = 'optimal';
    } else if (descStr.length >= 300 && descStr.length <= 1500) {
      descScore += 7;
      descDetails.lengthScore = 7;
      descDetails.lengthStatus = 'good';
    } else if (descStr.length >= 100 && descStr.length <= 2000) {
      descScore += 5;
      descDetails.lengthScore = 5;
      descDetails.lengthStatus = 'acceptable';
    } else {
      descScore += 2;
      descDetails.lengthScore = 2;
      descDetails.lengthStatus = 'needs_improvement';
    }
    descDetails.length = descStr.length;

    // Contenu riche : 8 points
    let contentScore = 0;
    // Caractéristiques principales (présence de mots techniques)
    const technicalWords = ['caractéristique', 'fonction', 'spécification', 'dimension', 'poids', 'matériau'];
    const hasTechnical = technicalWords.some(word => descStr.toLowerCase().includes(word));
    if (hasTechnical) {
      contentScore += 3;
    }
    // Bénéfices utilisateur
    const benefitWords = ['avantage', 'bénéfice', 'confort', 'qualité', 'performance'];
    const hasBenefits = benefitWords.some(word => descStr.toLowerCase().includes(word));
    if (hasBenefits) {
      contentScore += 2;
    }
    // Informations techniques
    const hasNumbers = /\d/.test(descStr);
    if (hasNumbers) {
      contentScore += 2;
    }
    // Utilisation/Contexte
    const usageWords = ['utilisation', 'usage', 'idéal pour', 'parfait pour'];
    const hasUsage = usageWords.some(word => descStr.toLowerCase().includes(word));
    if (hasUsage) {
      contentScore += 1;
    }
    descScore += contentScore;
    descDetails.contentScore = contentScore;

    // Structure : 4 points
    let structureScore = 0;
    const paragraphs = descStr.split(/\n\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length >= 2) {
      structureScore += 2;
    }
    const hasBulletPoints = /[•\-\*]/.test(descStr) || descStr.includes('<ul>');
    if (hasBulletPoints) {
      structureScore += 1;
    }
    const htmlTagCount = (descStr.match(/<[^>]+>/g) || []).length;
    if (htmlTagCount <= 10) {
      structureScore += 1;
    }
    descScore += structureScore;
    descDetails.structureScore = structureScore;

    // SEO : 3 points
    let seoScore = 0;
    const titleWords = title ? String(title).toLowerCase().split(/\s+/) : [];
    const descWords = descStr.toLowerCase().split(/\s+/);
    const matchingWords = titleWords.filter(word => descWords.includes(word) && word.length > 3);
    if (matchingWords.length > 0) {
      seoScore += 2;
    }
    const keywordDensity = matchingWords.length / Math.max(1, descWords.length);
    if (keywordDensity > 0.01 && keywordDensity < 0.05) {
      seoScore += 1;
    }
    descScore += seoScore;
    descDetails.seoScore = seoScore;

    details.description = { score: Math.min(descScore, 25), ...descDetails };
    score += details.description.score;
  } else {
    details.description = { score: 0 };
  }

  // === IMAGE (25 points) ===
  const imageUrl = getFieldValue(item, 'imageUrl', customFields) || 
                   getFieldValue(item, 'image_link', customFields) ||
                   getFieldValue(item, 'imageurl', customFields);
  if (imageUrl) {
    let imageScore = 0;
    const imageDetails = {};

    // Résolution : 12 points (on assume 800x800 si pas de vérification réelle)
    // Dans une vraie implémentation, on ferait un appel HTTP pour vérifier
    imageScore += 8; // On donne un score moyen par défaut
    imageDetails.resolutionScore = 8;
    imageDetails.resolutionStatus = 'assumed';

    // Ratio d'aspect : 5 points (on assume carré)
    imageScore += 4;
    imageDetails.aspectRatioScore = 4;

    // Qualité technique : 5 points
    const imageStr = String(imageUrl);
    const isWebP = imageStr.toLowerCase().includes('.webp');
    const isJPG = imageStr.toLowerCase().includes('.jpg') || imageStr.toLowerCase().includes('.jpeg');
    if (isWebP || isJPG) {
      imageScore += 3;
    } else {
      imageScore += 2;
    }
    imageDetails.formatScore = isWebP || isJPG ? 3 : 2;
    // Taille fichier (on assume raisonnable)
    imageScore += 2;
    imageDetails.fileSizeScore = 2;

    // Conformité visuelle : 3 points (on assume conforme)
    imageScore += 2;
    imageDetails.visualComplianceScore = 2;

    details.image = { score: Math.min(imageScore, 25), ...imageDetails };
    score += details.image.score;
  } else {
    details.image = { score: 0 };
  }

  // === PRIX (10 points) ===
  const price = item.price !== null && item.price !== undefined ? item.price : getFieldValue(item, 'price', customFields);
  if (price) {
    let priceScore = 0;
    const numPrice = typeof price === 'number' ? price : parseFloat(String(price));
    
    // Compétitivité : 5 points (on assume compétitif)
    priceScore += 3;
    
    // Présentation : 3 points
    if (!isNaN(numPrice) && numPrice > 0) {
      priceScore += 2;
    }
    const currency = item.currency || getFieldValue(item, 'currency', customFields);
    if (currency) {
      priceScore += 1;
    }
    
    // Cohérence : 2 points (on assume cohérent)
    priceScore += 1;
    
    details.price = { score: Math.min(priceScore, 10) };
    score += details.price.score;
  } else {
    details.price = { score: 0 };
  }

  // === DISPONIBILITÉ (5 points) ===
  const availability = getFieldValue(item, 'availability', customFields);
  const inventory = item.inventory != null ? Number(item.inventory) : null;
  if (availability || inventory != null) {
    const availStr = String(availability || '').toLowerCase().replace(/[-_\s]/g, '');
    const isInStock = ['instock', 'enstock', 'disponible'].includes(availStr) || (inventory != null && inventory > 0);
    const isPreorder = ['preorder', 'précommande', 'presale'].includes(availStr);
    const isBackorder = ['backorder', 'commandable', 'backordered'].includes(availStr);
    if (isInStock) {
      details.availability = { score: 5, status: 'in_stock' };
      score += 5;
    } else if (isPreorder) {
      details.availability = { score: 3, status: 'preorder' };
      score += 3;
    } else if (isBackorder) {
      details.availability = { score: 2, status: 'backorder' };
      score += 2;
    } else {
      details.availability = { score: 1, status: 'out_of_stock' };
      score += 1;
    }
  } else {
    details.availability = { score: 0 };
  }

  // === IDENTIFIANTS PRODUIT (10 points) ===
  let identifiersScore = 0;
  const gtin = getFieldValue(item, 'gtin', customFields);
  const mpn = getFieldValue(item, 'mpn', customFields);
  const brand = getFieldValue(item, 'brand', customFields);
  
  if (gtin) {
    identifiersScore += 5;
  }
  if (mpn) {
    identifiersScore += 3;
  }
  if (brand) {
    identifiersScore += 2;
  }
  
  details.identifiers = { score: identifiersScore, gtin: !!gtin, mpn: !!mpn, brand: !!brand };
  score += identifiersScore;

  return {
    score: Math.min(Math.round(score), 100),
    details
  };
}

/**
 * DIMENSION 3: OPTIMISATION SEO (0-100)
 * Évalue le potentiel de ranking et de visibilité
 */
function calculateSEOScore(item, customFields = {}) {
  let score = 0;
  const details = {};

  // === OPTIMISATION TITRE (30 points) ===
  const title = getFieldValue(item, 'title', customFields);
  if (title) {
    const titleStr = String(title).trim();
    let titleScore = 0;

    // Mots-clés primaires : 10 points
    // Détection basique : mots significatifs dans le titre
    const words = titleStr.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = new Set(words);
    titleScore += Math.min(10, (uniqueWords.size / Math.max(1, words.length)) * 10);

    // Richesse des mots-clés secondaires : 8 points
    // Présence de variations (adjectifs, attributs, specs après le nom de marque/modèle)
    const wordsAfterFirst = titleStr.split(/\s+/).slice(2);
    const hasSecondaryKeywords = wordsAfterFirst.length >= 3;
    titleScore += hasSecondaryKeywords ? 6 : 3;

    // Longue traîne : 7 points (titre suffisamment descriptif)
    if (titleStr.length >= 70) {
      titleScore += 5;
    } else if (titleStr.length >= 40) {
      titleScore += 3;
    } else {
      titleScore += 1;
    }

    // Unicité : 5 points — basé sur la diversité des mots (pas de répétitions)
    const allWords = titleStr.toLowerCase().split(/\s+/);
    const uniqueRatio = new Set(allWords).size / Math.max(1, allWords.length);
    titleScore += uniqueRatio >= 0.85 ? 4 : uniqueRatio >= 0.7 ? 2 : 0;

    details.title = { score: Math.min(titleScore, 30) };
    score += details.title.score;
  } else {
    details.title = { score: 0 };
  }

  // === OPTIMISATION DESCRIPTION (25 points) ===
  const description = getFieldValue(item, 'description', customFields) || 
                     getFieldValue(item, 'descriptionText', customFields) ||
                     getFieldValue(item, 'descriptionHtml', customFields);
  if (description) {
    const descStr = String(description).trim();
    let descScore = 0;

    // Mots-clés dans description : 10 points
    if (title) {
      const titleWords = String(title).toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const descWords = descStr.toLowerCase().split(/\s+/);
      const matchingWords = titleWords.filter(word => descWords.includes(word));
      descScore += Math.min(10, (matchingWords.length / Math.max(1, titleWords.length)) * 10);
    } else {
      descScore += 5;
    }

    // Structure sémantique : 8 points
    const brand = getFieldValue(item, 'brand', customFields);
    if (brand && descStr.toLowerCase().includes(brand.toLowerCase())) {
      descScore += 3;
    }
    // Présence de specs (nombres, dimensions, unités) — attributs structurés
    if (/\d+\s*(cm|mm|kg|g|ml|l|m²|pouces?|inches?|")/i.test(descStr)) {
      descScore += 3;
    }

    // Rich snippets potentiel : 7 points — liste de bullet points ou structure HTML
    const hasBullets = /[•\-\*]/.test(descStr) || /<ul|<li/i.test(descStr);
    const hasSchemaWords = /couleur|taille|poids|dimensions?|matière|matériau|garantie/i.test(descStr);
    descScore += hasBullets ? 3 : 0;
    descScore += hasSchemaWords ? 1 : 0;

    details.description = { score: Math.min(descScore, 25) };
    score += details.description.score;
  } else {
    details.description = { score: 0 };
  }

  // === CATÉGORISATION (20 points) ===
  let categorizationScore = 0;
  const googleCategory = getFieldValue(item, 'google_product_category', customFields);
  if (googleCategory) {
    const categoryStr = String(googleCategory);
    const depth = (categoryStr.match(/>/g) || []).length;
    if (depth >= 2) {
      categorizationScore += 12;
    } else {
      categorizationScore += 5;
    }
  }
  
  const productType = getFieldValue(item, 'product_type', customFields);
  if (productType) {
    categorizationScore += 5;
  }
  
  details.categorization = { score: Math.min(categorizationScore, 20), googleCategory: !!googleCategory, productType: !!productType };
  score += details.categorization.score;

  // === ATTRIBUTS ENRICHIS (25 points) ===
  let attributesScore = 0;
  const enrichedFields = ['color', 'size', 'material', 'gender', 'age_group', 'pattern'];
  let presentFields = 0;
  enrichedFields.forEach(field => {
    if (getFieldValue(item, field, customFields)) {
      presentFields++;
    }
  });
  attributesScore += Math.min(15, (presentFields / enrichedFields.length) * 15);

  const itemGroupId = getFieldValue(item, 'item_group_id', customFields);
  if (itemGroupId) {
    attributesScore += 5;
  }

  const shipping = getFieldValue(item, 'shipping', customFields);
  if (shipping) {
    attributesScore += 3;
  }

  details.attributes = { score: Math.min(attributesScore, 25), enrichedFieldsCount: presentFields };
  score += details.attributes.score;

  return {
    score: Math.min(Math.round(score), 100),
    details
  };
}

/**
 * DIMENSION 4: POTENTIEL DE CONVERSION (0-100)
 * Évalue le potentiel de vente et de conversion
 */
function calculateConversionScore(item, customFields = {}) {
  let score = 0;
  const details = {};

  // === ATTRACTIVITÉ VISUELLE (30 points) ===
  const imageUrl = getFieldValue(item, 'imageUrl', customFields) || 
                   getFieldValue(item, 'image_link', customFields) ||
                   getFieldValue(item, 'imageurl', customFields);
  if (imageUrl) {
    // Qualité image : 15 points — HTTPS + format standard = confiance raisonnable
    const imgStr = String(imageUrl);
    const isHttps = imgStr.startsWith('https://');
    const isStandardFormat = /\.(jpg|jpeg|png|webp)/i.test(imgStr);
    let visualScore = isHttps ? (isStandardFormat ? 10 : 7) : 4;
    
    // Images multiples : 10 points
    const additionalImages = getFieldValue(item, 'additional_image_link', customFields);
    if (additionalImages) {
      const imagesArray = Array.isArray(additionalImages) ? additionalImages : String(additionalImages).split(',');
      if (imagesArray.length >= 3) {
        visualScore += 10;
      } else if (imagesArray.length >= 1) {
        visualScore += 7;
      } else {
        visualScore += 4;
      }
    } else {
      visualScore += 4;
    }
    
    // Vidéos : 5 points (non implémenté pour l'instant)
    visualScore += 0;
    
    details.visual = { score: Math.min(visualScore, 30) };
    score += details.visual.score;
  } else {
    details.visual = { score: 0 };
  }

  // === INFORMATIONS PRODUIT (25 points) ===
  const description = getFieldValue(item, 'description', customFields) || 
                     getFieldValue(item, 'descriptionText', customFields) ||
                     getFieldValue(item, 'descriptionHtml', customFields);
  if (description) {
    const descStr = String(description).trim();
    let infoScore = 0;
    
    // Description complète : 10 points
    if (descStr.length >= 500) {
      infoScore += 10;
    } else if (descStr.length >= 300) {
      infoScore += 7;
    } else {
      infoScore += 4;
    }
    
    // Spécifications techniques : 8 points
    const hasSpecs = /\d+\s*(cm|mm|kg|g|ml|l|m²|pouces?|inches?|")/i.test(descStr);
    if (hasSpecs) {
      infoScore += 5;
    }
    // Bullet points / liste de caractéristiques
    if (/[•\-\*]/.test(descStr) || /<ul|<li/i.test(descStr)) {
      infoScore += 3;
    }

    // Informations pratiques : 7 points
    const hasPractical = /garantie|livraison|retour|échange/i.test(descStr);
    if (hasPractical) {
      infoScore += 4;
    }
    // Mentions de certifications ou labels
    if (/certifi|label|norme|iso|ce\b|rohs/i.test(descStr)) {
      infoScore += 3;
    }
    
    details.information = { score: Math.min(infoScore, 25) };
    score += details.information.score;
  } else {
    details.information = { score: 0 };
  }

  // === CONFIANCE ET PREUVE SOCIALE (25 points) ===
  // Signaux mesurables : brand, identifiants produit, garantie dans la description
  let trustScore = 0;
  const brandVal = getFieldValue(item, 'brand', customFields);
  if (brandVal) trustScore += 5;
  const gtinVal = getFieldValue(item, 'gtin', customFields);
  if (gtinVal) trustScore += 5;
  const mpnVal = getFieldValue(item, 'mpn', customFields);
  if (mpnVal) trustScore += 3;
  const conditionVal = getFieldValue(item, 'condition', customFields);
  if (conditionVal) trustScore += 2;
  // Mention garantie ou retour dans la description
  const descForTrust = getFieldValue(item, 'description', customFields) ||
                       getFieldValue(item, 'descriptionText', customFields) ||
                       getFieldValue(item, 'descriptionHtml', customFields);
  if (descForTrust && /garantie|retour|livraison|certifi/i.test(String(descForTrust))) {
    trustScore += 5;
  }
  details.trust = { score: Math.min(trustScore, 25) };
  score += details.trust.score;

  // === PRIX ET PROMOTION (20 points) ===
  const price = item.price !== null && item.price !== undefined ? item.price : getFieldValue(item, 'price', customFields);
  const salePrice = getFieldValue(item, 'sale_price', customFields);
  if (price) {
    let priceScore = 0;
    const numPrice = typeof price === 'number' ? price : parseFloat(String(price));

    // Prix valide et formaté : 10 points (on ne peut pas évaluer la compétitivité sans données de marché)
    if (!isNaN(numPrice) && numPrice > 0 && numPrice < 1000000) {
      priceScore += 5;
    }

    // Promotions : 10 points
    if (salePrice) {
      const numPriceCheck = numPrice;
      const numSalePrice = typeof salePrice === 'number' ? salePrice : parseFloat(String(salePrice));
      if (!isNaN(numPrice) && !isNaN(numSalePrice) && numPrice > numSalePrice) {
        const discount = ((numPrice - numSalePrice) / numPrice) * 100;
        if (discount >= 10) {
          priceScore += 10;
        } else {
          priceScore += 5;
        }
      } else {
        priceScore += 5;
      }
    } else {
      priceScore += 3;
    }
    
    details.pricing = { score: Math.min(priceScore, 20) };
    score += details.pricing.score;
  } else {
    details.pricing = { score: 0 };
  }

  return {
    score: Math.min(Math.round(score), 100),
    details
  };
}

/**
 * Calcule le score global multi-dimensionnel
 */
function calculateAdvancedQualityScore(item, customFields = {}) {
  try {
    // Normaliser les données de l'item
    // Note: ...item en premier pour que les mappings camelCase ci-dessous écrasent les valeurs DB lowercase
    const normalizedItem = {
      ...item,
      id: item.id,
      title: item.title,
      descriptionText: item.descriptionText || item.descriptiontext,
      descriptionHtml: item.descriptionHtml || item.descriptionhtml,
      description: item.description || item.descriptionText || item.descriptiontext || item.descriptionHtml || item.descriptionhtml,
      imageUrl: item.imageUrl || item.imageurl,
      price: item.price !== null && item.price !== undefined ? (typeof item.price === 'number' ? item.price : Number(item.price)) : null,
      currency: item.currency,
      brand: item.brand,
      sku: item.sku,
      gtin: item.gtin,
      mpn: item.mpn,
      condition: item.condition,
      availability: item.availability,
      url: item.url || item.link,
    };

    // Calculer les 4 dimensions avec gestion d'erreur individuelle
    let compliance, dataQuality, seo, conversion;
    
    try {
      compliance = calculateComplianceScore(normalizedItem, customFields);
    } catch (e) {
      console.error('Error calculating compliance score:', e);
      compliance = { score: 0, details: {}, blocking: false };
    }
    
    try {
      dataQuality = calculateDataQualityScore(normalizedItem, customFields);
    } catch (e) {
      console.error('Error calculating data quality score:', e);
      dataQuality = { score: 0, details: {} };
    }
    
    try {
      seo = calculateSEOScore(normalizedItem, customFields);
    } catch (e) {
      console.error('Error calculating SEO score:', e);
      seo = { score: 0, details: {} };
    }
    
    try {
      conversion = calculateConversionScore(normalizedItem, customFields);
    } catch (e) {
      console.error('Error calculating conversion score:', e);
      conversion = { score: 0, details: {} };
    }

    // Score global pondéré
    const globalScore = Math.round(
      (compliance.score * 0.30) +
      (dataQuality.score * 0.30) +
      (seo.score * 0.25) +
      (conversion.score * 0.15)
    );

    // Générer des recommandations
    let recommendations = [];
    try {
      recommendations = generateRecommendations(compliance, dataQuality, seo, conversion, normalizedItem, customFields);
    } catch (e) {
      console.error('Error generating recommendations:', e);
      recommendations = [];
    }

    return {
      qualityScore: Math.min(Math.max(globalScore, 0), 100),
      dimensions: {
        compliance: compliance.score || 0,
        dataQuality: dataQuality.score || 0,
        seo: seo.score || 0,
        conversion: conversion.score || 0
      },
      qualityDetails: {
        dimensions: {
          compliance: compliance.score || 0,
          dataQuality: dataQuality.score || 0,
          seo: seo.score || 0,
          conversion: conversion.score || 0
        },
        compliance: compliance.details || {},
        dataQuality: dataQuality.details || {},
        seo: seo.details || {},
        conversion: conversion.details || {},
        recommendations,
        blocking: compliance.blocking || false
      },
      blocking: compliance.blocking || false
    };
  } catch (error) {
    console.error('Error in calculateAdvancedQualityScore:', error);
    console.error('Error stack:', error.stack);
    console.error('Item data:', JSON.stringify(item, null, 2).substring(0, 500));
    throw error;
  }
}

/**
 * Génère des recommandations actionnables basées sur les scores
 */
function generateRecommendations(compliance, dataQuality, seo, conversion, item, customFields) {
  const recommendations = [];

  // Recommandations de conformité
  const issues = compliance.details?.issues || [];
  if (compliance.score < 70 && issues.length > 0) {
    issues.forEach(issue => {
      recommendations.push({
        priority: issue.severity === 'blocking' ? 'high' : issue.severity === 'error' ? 'high' : 'medium',
        category: 'conformity',
        field: issue.field,
        message: issue.message,
        impact: issue.severity === 'blocking' ? 'Le produit sera rejeté par Google' : 'Risque de rejet ou de visibilité réduite'
      });
    });
  }

  // Recommandations de qualité
  const titleDetail = dataQuality.details?.title;
  const titleLength = typeof titleDetail?.length === 'number' ? titleDetail.length : 0;
  if (titleLength > 0) {
    if (titleLength < 50 || titleLength > 60) {
      recommendations.push({
        priority: 'medium',
        category: 'quality',
        field: 'title',
        message: `Le titre fait ${titleLength} caractères. Optimiser à 50-60 caractères pour un meilleur affichage.`,
        impact: '+5-10% de visibilité'
      });
    }
  }

  const descDetail = dataQuality.details?.description;
  const descLength = typeof descDetail?.length === 'number' ? descDetail.length : 0;
  if (descLength > 0) {
    if (descLength < 500) {
      recommendations.push({
        priority: 'medium',
        category: 'quality',
        field: 'description',
        message: `La description fait ${descLength} caractères. Étendre à 500-1000 caractères pour plus de détails.`,
        impact: '+5-15% de visibilité'
      });
    }
  }

  // Recommandations SEO
  const seoCategorization = seo.details?.categorization;
  if (seoCategorization && !seoCategorization.googleCategory) {
    recommendations.push({
      priority: 'high',
      category: 'seo',
      field: 'google_product_category',
      message: 'Ajouter une catégorie Google précise pour améliorer le ciblage.',
      impact: '+10-20% de ranking'
    });
  }

  // Recommandations de conversion
  const additionalImages = getFieldValue(item, 'additional_image_link', customFields);
  if (!additionalImages) {
    recommendations.push({
      priority: 'medium',
      category: 'conversion',
      field: 'additional_image_link',
      message: 'Ajouter 2-3 images supplémentaires pour montrer le produit sous différents angles.',
      impact: '+5-10% de taux de conversion'
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

async function ensureProductScoreHistoryTable(prisma) {
  if (!prisma) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductScoreHistory" (
      id           TEXT PRIMARY KEY,
      itemid       TEXT NOT NULL REFERENCES "FeedItem"(id) ON DELETE CASCADE,
      qualityscore INTEGER NOT NULL CHECK (qualityscore >= 0 AND qualityscore <= 100),
      recordedat   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_productscorehistory_itemid ON "ProductScoreHistory"(itemid)`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_productscorehistory_recordedat ON "ProductScoreHistory"(recordedat DESC)`);
}

/**
 * Met à jour ou crée le score de qualité pour un item
 */
async function updateAdvancedQualityScore(prisma, itemId, item, customColumns = []) {
  try {
    // Construire customFields
    const customFields = {};
    if (item.customFields && typeof item.customFields === 'object') {
      Object.assign(customFields, item.customFields);
    }
    customColumns.forEach(col => {
      if (item[col.name]) {
        customFields[col.name] = item[col.name];
      }
    });
    
    // Calculer le score avancé
    const scoreData = calculateAdvancedQualityScore(item, customFields);

    // Vérifier si un score existe déjà
    const existingScore = await prisma.$queryRawUnsafe(`
      SELECT * FROM "ProductScore" WHERE itemid = $1::text
    `, itemId);
    
    const now = new Date().toISOString();
    const previousScore = existingScore && existingScore.length > 0 ? (existingScore[0].qualityscore ?? null) : null;
    const scoreChanged = previousScore === null || Number(previousScore) !== scoreData.qualityScore;
    
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
    
    // Historique : enregistrer un point à chaque changement de score (pour graphique d'évolution)
    if (scoreChanged) {
      try {
        await ensureProductScoreHistoryTable(prisma);
        await prisma.$executeRawUnsafe(`
          INSERT INTO "ProductScoreHistory" (id, itemid, qualityscore, recordedat)
          VALUES ($1::text, $2::text, $3::int, $4::timestamptz)
        `, crypto.randomUUID(), itemId, scoreData.qualityScore, now);
        // Garder au plus 60 points par item (supprimer les plus anciens)
        await prisma.$executeRawUnsafe(`
          DELETE FROM "ProductScoreHistory"
          WHERE itemid = $1::text
          AND recordedat < (
            SELECT COALESCE(MIN(recordedat), 'infinity'::timestamptz) FROM (
              SELECT recordedat FROM "ProductScoreHistory"
              WHERE itemid = $1::text
              ORDER BY recordedat DESC
              LIMIT 60
            ) t
          )
        `, itemId);
      } catch (historyErr) {
        console.warn('ProductScoreHistory insert skipped (table may not exist yet):', historyErr.message);
      }
    }
    
    return scoreData;
  } catch (error) {
    console.error('Error updating advanced quality score:', error);
    throw error;
  }
}

/**
 * Récupère le score de qualité pour un item
 */
async function getAdvancedQualityScore(prisma, itemId) {
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
    console.error('Error getting advanced quality score:', error);
    return null;
  }
}

module.exports = {
  calculateAdvancedQualityScore,
  updateAdvancedQualityScore,
  getAdvancedQualityScore,
  ensureProductScoreHistoryTable,
  calculateComplianceScore,
  calculateDataQualityScore,
  calculateSEOScore,
  calculateConversionScore
};
