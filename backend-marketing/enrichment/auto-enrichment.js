/**
 * Module d'enrichissement automatique des produits
 * Complète les champs manquants en les déduisant des données existantes
 * Génère des alertes pour les champs non complétables
 * Pour google_product_category / product_type : si vides → déduction/IA ; si fournis → validation et mapping vers une catégorie Google plus proche
 */

const { enrichWithAI } = require('./ai-enrichment');
const { validateOrMapGoogleCategory, validateOrMapProductType } = require('./auto-categorization');

// Champs requis et recommandés par Google Merchant Center
const REQUIRED_FIELDS = ['id', 'title', 'description', 'link', 'image_link', 'availability', 'price', 'condition'];
const RECOMMENDED_FIELDS = ['brand', 'gtin', 'mpn', 'google_product_category', 'product_type', 'color', 'size', 'material', 'pattern', 'gender', 'age_group'];

// Champs qui peuvent bénéficier de l'IA
const AI_ENRICHABLE_FIELDS = ['google_product_category', 'description', 'brand', 'material', 'pattern'];

const APPAREL_CATEGORY_PATTERNS = [
  /apparel/i,
  /clothing/i,
  /v[eê]tement/i,
  /fashion/i,
  /chauss/i,
  /shoe/i,
  /sneaker/i,
  /boot/i,
  /robe/i,
  /dress/i,
  /shirt/i,
  /t-shirt/i,
  /pantalon/i,
  /jean/i,
  /jacket/i,
  /coat/i,
  /sac/i,
  /bag/i,
  /bijou/i,
  /jewelry/i,
  /watch/i,
  /montre/i,
];

const HOME_CATEGORY_PATTERNS = [
  /furniture/i,
  /meuble/i,
  /matelas/i,
  /mattress/i,
  /canap[eé]/i,
  /sofa/i,
  /table/i,
  /chair/i,
  /chaise/i,
  /bed/i,
  /lit/i,
];

const NON_VARIANT_SIZE_CATEGORY_PATTERNS = [
  /appliance/i,
  /electronic/i,
  /electronics/i,
  /tv/i,
  /television/i,
  /lave[- ]?linge/i,
  /s[eé]che[- ]?linge/i,
  /dryer/i,
  /washing/i,
  /refrigerator/i,
  /fridge/i,
  /micro-ondes/i,
  /microwave/i,
  /robot cuiseur/i,
  /vacuum/i,
  /aspirateur/i,
];

function getClassificationText(item) {
  return [
    item.title,
    item.descriptionText,
    item.productType,
    item.customFields?.product_type,
    item.customFields?.google_product_category,
    item.customFields?.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isApparelLikeProduct(item) {
  return matchesAnyPattern(getClassificationText(item), APPAREL_CATEGORY_PATTERNS);
}

function isHomeDimensionProduct(item) {
  return matchesAnyPattern(getClassificationText(item), HOME_CATEGORY_PATTERNS);
}

function isNonVariantSizeProduct(item) {
  return matchesAnyPattern(getClassificationText(item), NON_VARIANT_SIZE_CATEGORY_PATTERNS);
}

function isFieldApplicable(item, fieldName) {
  switch (fieldName) {
    case 'size':
      return isApparelLikeProduct(item) || isHomeDimensionProduct(item);
    case 'gender':
    case 'age_group':
    case 'pattern':
      return isApparelLikeProduct(item);
    case 'shipping':
    case 'tax':
      return false;
    default:
      return true;
  }
}

/**
 * Extrait une valeur depuis un texte en utilisant des patterns
 */
function extractFromText(text, patterns) {
  if (!text || typeof text !== 'string') return null;
  const lowerText = text.toLowerCase();
  
  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      if (lowerText.includes(pattern.toLowerCase())) {
        return pattern;
      }
    } else if (pattern instanceof RegExp) {
      const match = lowerText.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
  }
  return null;
}

/**
 * Déduit la marque (brand) depuis le titre ou d'autres champs
 */
function deduceBrand(item) {
  // Si brand existe déjà, le retourner
  if (item.brand) return item.brand;
  
  // Chercher dans customFields
  if (item.customFields?.brand) return item.customFields.brand;
  
  // Extraire depuis le titre (premiers mots souvent)
  if (item.title) {
    const titleWords = item.title.split(/\s+/);
    // Les marques sont souvent les 1-2 premiers mots
    if (titleWords.length > 1) {
      const possibleBrand = titleWords[0] + (titleWords[1] ? ' ' + titleWords[1] : '');
      // Filtrer les mots trop courts ou communs
      if (possibleBrand.length > 2 && !['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du'].includes(possibleBrand.toLowerCase())) {
        return possibleBrand;
      }
    }
  }
  
  return null;
}

/**
 * Déduit la condition depuis les données existantes
 */
function deduceCondition(item) {
  if (item.condition) return item.condition;
  if (item.customFields?.condition) return item.customFields.condition;
  
  // Valeur par défaut pour Google Shopping
  return 'new';
}

/**
 * Déduit la disponibilité (availability) depuis l'inventaire
 */
function deduceAvailability(item) {
  if (item.customFields?.availability) return item.customFields.availability;
  
  // Si inventory est défini
  if (item.inventory !== null && item.inventory !== undefined) {
    const inventory = Number(item.inventory);
    if (inventory > 0) {
      return 'in stock';
    } else {
      return 'out of stock';
    }
  }
  
  // Valeur par défaut
  return 'in stock';
}

/**
 * Déduit le genre (gender) depuis le titre ou la catégorie
 */
function deduceGender(item) {
  if (!isApparelLikeProduct(item)) return null;
  if (item.customFields?.gender) return item.customFields.gender;
  
  const text = (item.title || '') + ' ' + (item.descriptionText || '') + ' ' + (item.customFields?.google_product_category || '');
  const lowerText = text.toLowerCase();
  
  const patterns = {
    'male': ['homme', 'men', 'masculin', 'garçon', 'boy', 'mâle'],
    'female': ['femme', 'women', 'féminin', 'fille', 'girl', 'femelle'],
    'unisex': ['unisexe', 'unisex', 'mixte']
  };
  
  for (const [gender, keywords] of Object.entries(patterns)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return gender;
    }
  }
  
  return null;
}

/**
 * Déduit le groupe d'âge (age_group) depuis le titre ou la catégorie
 */
function deduceAgeGroup(item) {
  if (!isApparelLikeProduct(item)) return null;
  if (item.customFields?.age_group) return item.customFields.age_group;
  
  const text = (item.title || '') + ' ' + (item.descriptionText || '') + ' ' + (item.customFields?.google_product_category || '');
  const lowerText = text.toLowerCase();
  
  const patterns = {
    'adult': ['adulte', 'adult', 'homme', 'femme', 'men', 'women'],
    'teen': ['ado', 'teen', 'adolescent', 'adolescente'],
    'kids': ['enfant', 'kid', 'child', 'bébé', 'baby', 'bebe', 'junior'],
    'infant': ['bébé', 'baby', 'bebe', 'nourrisson', 'infant', '0-12 mois']
  };
  
  for (const [ageGroup, keywords] of Object.entries(patterns)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return ageGroup;
    }
  }
  
  return null;
}

/**
 * Extrait la couleur depuis le titre ou la description
 */
function deduceColor(item) {
  if (item.customFields?.color) return item.customFields.color;
  
  const text = (item.title || '') + ' ' + (item.descriptionText || '');
  const colors = [
    'rouge', 'red', 'bleu', 'blue', 'vert', 'green', 'jaune', 'yellow',
    'noir', 'black', 'blanc', 'white', 'gris', 'gray', 'gris', 'grey',
    'rose', 'pink', 'orange', 'violet', 'purple', 'marron', 'brown',
    'beige', 'doré', 'gold', 'argenté', 'silver'
  ];
  
  for (const color of colors) {
    if (text.toLowerCase().includes(color.toLowerCase())) {
      return color.charAt(0).toUpperCase() + color.slice(1);
    }
  }
  
  return null;
}

/**
 * Extrait la taille depuis le titre ou la description
 */
function deduceSize(item) {
  if (!isFieldApplicable(item, 'size') || isNonVariantSizeProduct(item)) return null;
  if (item.customFields?.size) return item.customFields.size;
  
  const text = (item.title || '') + ' ' + (item.descriptionText || '');
  // Patterns pour les tailles (vêtements, chaussures, etc.)
  const sizePatterns = [
    /\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/i,
    /\b(\d+)\s*(ans|years?|mois|months?)\b/i,
    /\b(\d+)\s*(cm|mm|m)\b/i,
    /\b(36|37|38|39|40|41|42|43|44|45|46|47|48)\b/,
    /\b(one\s*size|taille\s*unique|universal)\b/i
  ];
  
  for (const pattern of sizePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

/**
 * Déduit la catégorie Google Product depuis le product_type ou le titre
 */
function deduceGoogleProductCategory(item) {
  if (item.customFields?.google_product_category) return item.customFields.google_product_category;
  const { mapSourceToGoogleCategory } = require('./auto-categorization');
  const productType = item.customFields?.product_type || item.productType;
  if (productType) {
    const mapped = mapSourceToGoogleCategory(productType);
    if (mapped) return mapped;
  }
  const title = (item.title || '').toLowerCase();
  if (title) {
    const mapped = mapSourceToGoogleCategory(item.title);
    if (mapped) return mapped;
  }
  return null;
}

/**
 * Déduit le type de produit (product_type) depuis le titre, la catégorie Google ou les customFields
 */
function deduceProductType(item) {
  if (item.customFields?.product_type) return item.customFields.product_type;
  if (item.productType) return item.productType;
  const gpc = item.customFields?.google_product_category || '';
  if (gpc && typeof gpc === 'string') {
    const parts = gpc.split(' > ');
    if (parts.length > 0) return parts[parts.length - 1].trim();
  }
  const title = (item.title || '').trim();
  if (!title) return null;
  const lower = title.toLowerCase();
  const types = ['t-shirt', 'chemise', 'pantalon', 'robe', 'veste', 'manteau', 'chaussures', 'sneakers', 'sac', 'bijou', 'livre', 'ordinateur', 'téléphone', 'casque', 'meuble', 'luminaire', 'jouet', 'cosmétique', 'parfum', 'montre'];
  for (const t of types) {
    if (lower.includes(t)) return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return null;
}

/**
 * Déduit les informations de livraison (shipping) - valeur par défaut
 */
function deduceShipping(item) {
  if (item.customFields?.shipping) return item.customFields.shipping;
  
  // Valeur par défaut (peut être configurée par source)
  return {
    country: 'FR',
    service: 'Standard',
    price: { value: '0', currency: 'EUR' }
  };
}

/**
 * Déduit les informations de taxe (tax) - valeur par défaut
 */
function deduceTax(item) {
  if (item.customFields?.tax) return item.customFields.tax;
  
  // Valeur par défaut pour la France (TVA 20%)
  return {
    country: 'FR',
    rate: '20.0',
    tax_ship: 'yes'
  };
}

/**
 * Analyse un produit et génère les enrichissements possibles
 */
function analyzeProduct(item) {
  const enrichments = {};
  const alerts = [];
  
  // Normaliser customFields
  const customFields = item.customFields || (item.customfields ? (typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields) : {});
  
  // Créer un objet unifié pour faciliter l'accès
  const unifiedItem = {
    ...item,
    customFields: customFields
  };
  
  // Analyser les champs requis
  for (const field of REQUIRED_FIELDS) {
    const value = getFieldValue(unifiedItem, field);
    if (!value || value === null || value === '') {
      // Essayer de déduire
      const deduced = tryDeduceField(unifiedItem, field);
      if (deduced) {
        enrichments[field] = deduced;
      } else {
        alerts.push({
          field,
          level: 'error',
          message: `Champ requis manquant: ${field}`,
          suggestion: getSuggestionForField(field)
        });
      }
    }
  }
  
  // Analyser les champs recommandés
  for (const field of RECOMMENDED_FIELDS) {
    if (!isFieldApplicable(unifiedItem, field)) continue;
    const value = getFieldValue(unifiedItem, field);
    if (!value || value === null || value === '') {
      // Essayer de déduire
      const deduced = tryDeduceField(unifiedItem, field);
      if (deduced) {
        enrichments[field] = deduced;
      } else {
        alerts.push({
          field,
          level: 'warning',
          message: `Champ recommandé manquant: ${field}`,
          suggestion: getSuggestionForField(field)
        });
      }
    }
  }

  // Catégories fournies : valider et proposer une GPC / product_type plus proche si besoin
  const currentGpc = getFieldValue(unifiedItem, 'google_product_category') || enrichments.google_product_category || '';
  const gpcResult = validateOrMapGoogleCategory(currentGpc, unifiedItem);
  if (gpcResult.suggested && String(gpcResult.suggested).trim() !== String(currentGpc).trim()) {
    enrichments.google_product_category = gpcResult.suggested;
    if (gpcResult.message) {
      alerts.push({
        field: 'google_product_category',
        level: 'info',
        message: gpcResult.message,
        suggestion: gpcResult.suggested
      });
    }
  }
  if (gpcResult.shouldEnrich && !enrichments.google_product_category && !currentGpc) {
    const deduced = deduceGoogleProductCategory(unifiedItem);
    if (deduced) enrichments.google_product_category = deduced;
  }

  const currentProductType = getFieldValue(unifiedItem, 'product_type') || enrichments.product_type || '';
  const ptResult = validateOrMapProductType(currentProductType, unifiedItem);
  if (ptResult.shouldEnrich && !enrichments.product_type && !currentProductType) {
    const deduced = deduceProductType(unifiedItem);
    if (deduced) enrichments.product_type = deduced;
  }

  return { enrichments, alerts };
}

/**
 * Analyse un produit avec enrichissement IA pour les champs complexes
 */
async function analyzeProductWithAI(prisma, item, useAI = false) {
  // D'abord, faire l'analyse standard (règles)
  const standardAnalysis = analyzeProduct(item);
  
  // Si on ne doit pas utiliser l'IA, retourner l'analyse standard
  if (!useAI || !prisma) {
    return standardAnalysis;
  }
  
  // Identifier les champs qui pourraient bénéficier de l'IA
  const fieldsForAI = [];
  for (const field of AI_ENRICHABLE_FIELDS) {
    // Si le champ n'a pas été enrichi par les règles et qu'il manque
    if (!standardAnalysis.enrichments[field]) {
      const value = getFieldValue(item, field);
      if (!value || value === null || value === '') {
        fieldsForAI.push(field);
      }
    }
  }
  
  // Si aucun champ ne nécessite l'IA, retourner l'analyse standard
  if (fieldsForAI.length === 0) {
    return standardAnalysis;
  }
  
  // Enrichir avec l'IA
  try {
    const aiResult = await enrichWithAI(prisma, item, fieldsForAI);
    
    // Fusionner les enrichissements IA avec les enrichissements standard
    const mergedEnrichments = {
      ...standardAnalysis.enrichments,
      ...aiResult.enrichments
    };
    
    // Mettre à jour les alertes : retirer celles qui ont été résolues par l'IA
    const resolvedFields = Object.keys(aiResult.enrichments);
    const updatedAlerts = standardAnalysis.alerts.filter(
      alert => !resolvedFields.includes(alert.field)
    );
    
    return {
      enrichments: mergedEnrichments,
      alerts: updatedAlerts,
      aiEnrichments: aiResult.enrichments,
      aiErrors: aiResult.errors
    };
  } catch (error) {
    console.warn('Erreur enrichissement IA, utilisation des règles uniquement:', error.message);
    // En cas d'erreur IA, retourner l'analyse standard
    return standardAnalysis;
  }
}

/**
 * Récupère la valeur d'un champ depuis l'item
 */
function getFieldValue(item, fieldName) {
  // Mapping des noms de champs GMC vers les colonnes de la DB
  const fieldMapping = {
    'id': ['id', 'originId', 'originid', 'sku', 'gtin', 'mpn'],
    'title': ['title'],
    'description': ['descriptionText', 'descriptiontext', 'descriptionHtml', 'descriptionhtml'],
    'link': ['url', 'link'],
    'image_link': ['imageUrl', 'imageurl', 'image_link'],
    'availability': ['availability'],
    'price': ['price'],
    'condition': ['condition'],
    'brand': ['brand'],
    'gtin': ['gtin'],
    'mpn': ['mpn'],
    'google_product_category': ['googleProductCategory', 'google_product_category'],
    'product_type': ['productType', 'product_type'],
    'color': ['color'],
    'size': ['size'],
    'material': ['material'],
    'pattern': ['pattern'],
    'gender': ['gender'],
    'age_group': ['ageGroup', 'age_group'],
    'shipping': ['shipping'],
    'tax': ['tax']
  };
  
  const possibleKeys = fieldMapping[fieldName] || [fieldName];
  
  // Chercher dans les colonnes standard
  for (const key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  
  // Chercher dans customFields
  if (item.customFields) {
    for (const key of possibleKeys) {
      if (item.customFields[key] !== undefined && item.customFields[key] !== null && item.customFields[key] !== '') {
        return item.customFields[key];
      }
    }
  }
  
  return null;
}

/**
 * Essaie de déduire un champ
 */
function tryDeduceField(item, fieldName) {
  switch (fieldName) {
    case 'brand':
      return deduceBrand(item);
    case 'condition':
      return deduceCondition(item);
    case 'availability':
      return deduceAvailability(item);
    case 'gender':
      return deduceGender(item);
    case 'age_group':
      return deduceAgeGroup(item);
    case 'color':
      return deduceColor(item);
    case 'size':
      return deduceSize(item);
    case 'google_product_category':
      return deduceGoogleProductCategory(item);
    case 'product_type':
      return deduceProductType(item);
    case 'shipping':
      return deduceShipping(item);
    case 'tax':
      return deduceTax(item);
    default:
      return null;
  }
}

/**
 * Génère une suggestion pour un champ manquant
 */
function getSuggestionForField(fieldName) {
  const suggestions = {
    'brand': 'Ajoutez la marque dans le titre ou dans une colonne dédiée',
    'gtin': 'Ajoutez le code-barres GTIN/EAN du produit',
    'mpn': 'Ajoutez le numéro de modèle du fabricant (MPN)',
    'google_product_category': 'Définissez la catégorie Google Product Category',
    'product_type': 'Définissez le type de produit',
    'color': 'Ajoutez la couleur dans le titre ou la description',
    'size': 'Ajoutez la taille dans le titre ou la description',
    'gender': 'Ajoutez le genre dans le titre ou la catégorie',
    'age_group': 'Ajoutez le groupe d\'âge dans le titre ou la catégorie'
  };
  
  return suggestions[fieldName] || `Complétez le champ ${fieldName}`;
}

/**
 * Enrichit un produit avec les valeurs déduites
 */
function enrichProduct(item, enrichments) {
  // Mettre à jour customFields avec les enrichissements
  const customFields = item.customFields || (item.customfields ? (typeof item.customfields === 'string' ? JSON.parse(item.customfields) : item.customfields) : {});
  
  const updatedCustomFields = { ...customFields };
  
  // Ajouter les enrichissements dans customFields
  for (const [field, value] of Object.entries(enrichments)) {
    if (value !== null && value !== undefined) {
      updatedCustomFields[field] = value;
    }
  }
  
  return {
    ...item,
    customFields: updatedCustomFields,
    enrichedFields: Object.keys(enrichments)
  };
}

module.exports = {
  analyzeProduct,
  analyzeProductWithAI,
  enrichProduct,
  deduceBrand,
  deduceCondition,
  deduceAvailability,
  deduceGender,
  deduceAgeGroup,
  deduceColor,
  deduceSize,
  deduceGoogleProductCategory,
  deduceProductType,
  deduceShipping,
  deduceTax,
  REQUIRED_FIELDS,
  RECOMMENDED_FIELDS,
  AI_ENRICHABLE_FIELDS
};

