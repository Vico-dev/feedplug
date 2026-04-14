/**
 * 🎯 Module de génération de Product Highlights avec IA
 *
 * Génère des points forts produit (bullet points) basés sur les caractéristiques
 * pour maximiser la conversion sur Amazon, Meta, GMC et autres plateformes.
 *
 * Features:
 * - 3 à 5 highlights par produit
 * - Adaptatifs à l'industrie et à la plateforme
 * - Cache intelligent (économie 70-80%)
 * - Fallback sur extraction heuristique si IA échoue
 */

const { callAIWithCache } = require('../ai/ai-wrapper');
const { PROMOTIONAL_PHRASES_DESC } = require('./gmc-guidelines');

// Nombre max de highlights par plateforme
const PLATFORM_HIGHLIGHTS_CONFIG = {
  AMAZON: { count: 5, maxChars: 500 },
  META: { count: 4, maxChars: 250 },
  GMC: { count: 5, maxChars: 150 },
  CHATGPT: { count: 5, maxChars: 300 },
  DEFAULT: { count: 4, maxChars: 250 }
};

/**
 * Détecte l'industrie depuis les données produit (même logique que title-optimizer)
 */
function detectIndustry(product) {
  const cf = product.customfields || product.customFields || {};
  const category = (cf.google_product_category || '').toLowerCase();
  const title = (product.title || '').toLowerCase();
  const desc = (product.descriptiontext || product.descriptionText || product.description || '').toLowerCase();
  const all = `${category} ${title} ${desc}`;

  if (/apparel|clothing|fashion|vetement|mode|shirt|pant|dress|shoe|chaussure|accessoire|bijou|jewelry/i.test(all)) return 'fashion';
  if (/beauty|health|cosmetic|skincare|makeup|parfum|perfume|soin|creme|serum|beaute|sante|hygiene/i.test(all)) return 'beauty';
  if (/electronics|computer|phone|tablet|audio|video|camera|tv|laptop|smartphone|tech|electronique|informatique/i.test(all)) return 'tech';
  if (/food|beverage|drink|grocery|gourmet|bio|organic|alimentaire|boisson|nourriture|epicerie/i.test(all)) return 'food';
  if (/home|furniture|decor|garden|kitchen|bedroom|living|maison|meuble|decoration|jardin|cuisine/i.test(all)) return 'home';
  if (/sport|fitness|outdoor|running|cycling|velo|natation|randonnee|musculation/i.test(all)) return 'sport';
  return 'general';
}

/**
 * Construit le contexte produit pour le prompt IA
 */
function buildProductContext(product) {
  const cf = product.customfields || product.customFields || {};
  const desc = (product.descriptiontext || product.descriptionText || cf.description || '').replace(/<[^>]*>/g, '').trim();

  const fields = [
    `Titre : ${product.title || 'Non spécifié'}`,
    `Marque : ${product.brand || cf.brand || 'Non spécifié'}`,
    product.sku ? `SKU : ${product.sku}` : null,
    cf.google_product_category ? `Catégorie : ${cf.google_product_category}` : null,
    cf.color ? `Couleur : ${cf.color}` : null,
    cf.size ? `Taille : ${cf.size}` : null,
    cf.material ? `Matière : ${cf.material}` : null,
    cf.capacity ? `Capacité : ${cf.capacity}` : null,
    cf.power || cf.wattage ? `Puissance : ${cf.power || cf.wattage}` : null,
    cf.compatibility ? `Compatibilité : ${cf.compatibility}` : null,
    cf.gender ? `Genre : ${cf.gender}` : null,
    cf.age_group ? `Tranche d'âge : ${cf.age_group}` : null,
    cf.pattern ? `Motif : ${cf.pattern}` : null,
    product.condition ? `État : ${product.condition}` : null,
    product.gtin ? `GTIN : ${product.gtin}` : null,
    desc ? `Description : ${desc.substring(0, 400)}` : null,
  ].filter(Boolean);

  return fields.join('\n');
}

// Templates de prompts par industrie
const INDUSTRY_SYSTEM_PROMPTS = {
  fashion: `Tu es un expert en e-commerce mode et en copywriting produit.
Tu génères des points forts produit (bullet points) convaincants pour maximiser les ventes.
Focus : matières, style, fit, occasions d'utilisation, soin.`,

  beauty: `Tu es un expert en e-commerce beauté et cosmétiques.
Tu génères des points forts produit pour des produits beauté/soin.
Focus : ingrédients clés, bénéfices peau/cheveux, résultats attendus, certifications, format.`,

  tech: `Tu es un expert en e-commerce high-tech et électronique.
Tu génères des points forts produit pour des produits technologiques.
Focus : specs techniques clés, compatibilité, performances, facilité d'usage, garantie.`,

  food: `Tu es un expert en e-commerce alimentaire et épicerie fine.
Tu génères des points forts produit pour des produits alimentaires.
Focus : origine, labels bio/certifications, goût, composition, format, conservation.`,

  home: `Tu es un expert en e-commerce maison et décoration.
Tu génères des points forts produit pour des articles de maison.
Focus : dimensions, matières, style déco, montage/installation, entretien, garantie.`,

  sport: `Tu es un expert en e-commerce sport et outdoor.
Tu génères des points forts produit pour des équipements sportifs.
Focus : performances, technologies, confort, niveaux pratiquants, résistance, poids.`,

  general: `Tu es un expert en e-commerce et copywriting produit.
Tu génères des points forts produit (bullet points) convaincants pour maximiser les ventes.
Focus : avantages clés, caractéristiques différenciantes, bénéfices utilisateur.`
};

/**
 * Génère le prompt utilisateur pour les highlights
 */
function buildUserPrompt(product, platform, count, maxChars) {
  const context = buildProductContext(product);
  const industry = detectIndustry(product);

  const platformInstructions = {
    AMAZON: `Format Amazon : Commence chaque point par une majuscule. Style factuel et orienté bénéfice acheteur. Mots-clés A9 naturellement intégrés.`,
    META: `Format Meta/Instagram : Style engageant et émotionnel. Mettre en avant le bénéfice lifestyle et l'aspiration.`,
    GMC: `Format Google Merchant Center : 5 fragments courts et concrets, maximum ${maxChars} caractères chacun. Chaque ligne doit décrire un attribut, une capacité, une matière, une compatibilité ou un usage réel du produit. Pas de prix, pas de promo, pas d'expédition, pas de politique magasin, pas de nom de catégorie, pas de répétition du titre, pas de simple ligne "Marque : X".`,
    CHATGPT: `Format LLM/assistant : Structuré et informatif. Répondre aux questions typiques d'un acheteur.`,
    DEFAULT: `Style professionnel e-commerce. Factuel et convaincant.`
  };

  return `Génère exactement ${count} points forts (highlights/bullet points) pour ce produit.

Informations produit :
${context}

Règles STRICTES :
1. Exactement ${count} points, un par ligne, sans numérotation ni tiret
2. Maximum ${maxChars} caractères par point
3. Chaque point met en avant un avantage ou caractéristique DIFFÉRENT
4. Pas de répétition d'information entre les points
5. Pas de points promotionnels ("promo", "gratuit", "réduction")
6. Si une information est absente, ne pas l'inventer
7. ${platformInstructions[platform] || platformInstructions.DEFAULT}
8. En français
9. Utiliser des formulations courtes et scannables, pas de paragraphe

Réponds UNIQUEMENT avec les ${count} points, un par ligne, sans aucun autre texte.`;
}

const GENERIC_GMC_MARKETING_PATTERNS = [
  /\bqualit[ée]\b/i,
  /\binnovation\b/i,
  /\balli[ée]\b/i,
  /\bid[ée]al\b/i,
  /\bquotidien\b/i,
  /\bintuitif\b/i,
  /\bperformant\b/i,
  /\bgagnez\b/i,
  /\br[ée]inventer\b/i,
  /\bcuisine simplifi[ée]e\b/i,
  /\bgrande vari[ée]t[ée] de plats\b/i,
];

const FACTUAL_HINTS = /(cm|mm|m\b|kg|g\b|l\b|ml|w\b|wh\b|mah\b|hz\b|db\b|go\b|tb\b|mp\b|4k\b|8k\b|bluetooth|wifi|usb|hdmi|inox|acier|verre|c[ée]ramique|bois|coton|laine|cuir|bol|cuve|capacit[ée]|puissance|autonomie|compatible|lavable|amovible|programm(?:e|es)|vitess(?:e|es)|mode(?:s)?|r[ée]solution|[0-9]+)/i;

function normalizeHighlightKey(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function extractDescriptionFragments(product, maxChars) {
  const source = (product.descriptiontext || product.descriptionText || product.description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!source) return [];
  return source
    .split(/[.!?;]|(?:\s[-•]\s)/)
    .map((entry) => sanitizeHighlight(entry, maxChars))
    .filter((entry) => entry.length > 12 && entry.length <= maxChars);
}

function extractStructuredFactHighlights(product, maxChars) {
  const cf = product.customfields || product.customFields || {};
  const candidates = [
    cf.capacity ? `Capacité ${cf.capacity}` : null,
    cf.power || cf.wattage ? `Puissance ${cf.power || cf.wattage}` : null,
    cf.size || cf.dimensions ? `Dimensions ${cf.size || cf.dimensions}` : null,
    cf.material ? `Matière ${cf.material}` : null,
    cf.color ? `Coloris ${cf.color}` : null,
    cf.compatibility ? `Compatible ${cf.compatibility}` : null,
    cf.programs ? `${cf.programs} programmes` : null,
    cf.features ? String(cf.features) : null,
  ];

  return candidates
    .map((entry) => sanitizeHighlight(entry, maxChars))
    .filter(Boolean);
}

function isGmcHighlightAcceptable(product, value, maxChars) {
  const highlight = sanitizeHighlight(value, maxChars);
  if (!highlight) return false;
  if (highlight.length < 10 || highlight.length > maxChars) return false;
  if (GENERIC_GMC_MARKETING_PATTERNS.some((pattern) => pattern.test(highlight))) return false;
  if (/^[A-ZÀ-ÿ][A-Za-zÀ-ÿ0-9\s&'/-]{1,20}:\s/i.test(highlight)) return false;
  if (/(livraison|expédition|shipping|promo|réduction|discount|gratuit|offre limitée|service client|retour)/i.test(highlight)) return false;

  const title = String(product.title || '').toLowerCase();
  const normalized = normalizeHighlightKey(highlight);
  if (normalized && title.includes(normalized) && !FACTUAL_HINTS.test(highlight)) return false;

  return FACTUAL_HINTS.test(highlight);
}

function buildGmcHighlights(product, aiHighlights, count, maxChars) {
  const merged = [];
  const seen = new Set();
  const push = (value) => {
    const highlight = sanitizeHighlight(value, maxChars);
    const key = normalizeHighlightKey(highlight);
    if (!highlight || !key || seen.has(key)) return;
    if (!isGmcHighlightAcceptable(product, highlight, maxChars)) return;
    seen.add(key);
    merged.push(highlight);
  };

  aiHighlights.forEach(push);
  extractStructuredFactHighlights(product, maxChars).forEach(push);
  extractDescriptionFragments(product, maxChars).forEach(push);

  return merged.slice(0, count);
}

/**
 * Parse la réponse IA en tableau de highlights
 */
function parseHighlightsResponse(text, count, maxChars) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 10)
    // Retirer les prefixes courants : "1.", "-", "•", "*"
    .map(l => l.replace(/^[\d]+[.)\s]+/, '').replace(/^[-•*]\s*/, '').trim())
    .map(l => sanitizeHighlight(l, maxChars))
    .filter(l => l.length > 10);

  const deduped = [];
  const seen = new Set();
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(line);
    if (deduped.length >= count) break;
  }
  return deduped;
}

function sanitizeHighlight(text, maxChars) {
  let value = String(text || '').trim();
  for (const phrase of PROMOTIONAL_PHRASES_DESC) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    value = value.replace(re, ' ');
  }
  value = value
    .replace(/^(marque|brand|prix|price|catégorie|categorie|category|sku|gtin|mpn)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.;,:-]+$/g, '')
    .trim();

  if (/(livraison|expédition|shipping|promo|réduction|discount|gratuit|offre limitée|click here|cliquez ici)/i.test(value)) {
    return '';
  }
  if (/(€| eur\b| usd\b| \$| £)/i.test(value)) {
    return '';
  }
  if (value.length > maxChars) {
    value = value.substring(0, maxChars).replace(/[ ,;:-]+$/g, '').trim();
  }
  return value;
}

/**
 * Fallback heuristique si l'IA échoue : extrait des points depuis la description
 */
function extractHighlightsFallback(product, count, maxChars) {
  const cf = product.customfields || product.customFields || {};
  const highlights = [];

  // 1. Caractéristiques directes
  if (cf.material) highlights.push(`Matière ${cf.material}`);
  if (cf.color) highlights.push(`Coloris ${cf.color}`);
  if (cf.size) highlights.push(`Dimensions ou taille ${cf.size}`);
  if (cf.capacity) highlights.push(`Capacité ${cf.capacity}`);
  if (cf.power || cf.wattage) highlights.push(`Puissance ${cf.power || cf.wattage}`);
  if (cf.compatibility) highlights.push(`Compatible ${cf.compatibility}`);
  if (product.condition && product.condition !== 'new') {
    highlights.push(`État ${product.condition}`);
  }

  // 2. Points depuis la description (premières phrases)
  const desc = (product.descriptiontext || product.descriptionText || '').replace(/<[^>]*>/g, '').trim();
  if (desc && highlights.length < count) {
    const sentences = desc
      .split(/[.!?]/)
      .map(s => sanitizeHighlight(s, maxChars))
      .filter(s => s.length > 20 && s.length < maxChars);
    sentences.slice(0, count - highlights.length).forEach(s => highlights.push(s));
  }

  // 3. Titre comme fallback final
  if (highlights.length === 0 && product.title) {
    highlights.push(sanitizeHighlight(product.title, maxChars));
  }

  return highlights.filter(Boolean).slice(0, count);
}

/**
 * Génère des highlights produit avec IA
 * @param {Object} prisma - Instance Prisma
 * @param {Object} product - Données produit (FeedItem)
 * @param {Object} options - { platform, forceRefresh, industry }
 * @returns {Promise<Object>} { highlights: string[], platform, cached, industry }
 */
async function generateHighlightsWithAI(prisma, product, options = {}) {
  const platform = (options.platform || 'GMC').toUpperCase();
  const forceRefresh = options.forceRefresh || false;

  if (!product || !product.id) {
    throw new Error('Produit invalide (ID manquant)');
  }

  const config = PLATFORM_HIGHLIGHTS_CONFIG[platform] || PLATFORM_HIGHLIGHTS_CONFIG.DEFAULT;
  const industry = options.industry || detectIndustry(product);
  const systemPrompt = INDUSTRY_SYSTEM_PROMPTS[industry] || INDUSTRY_SYSTEM_PROMPTS.general;
  const userPrompt = buildUserPrompt(product, platform, config.count, config.maxChars);

  const cf = product.customfields || product.customFields || {};

  try {
    const result = await callAIWithCache(
      prisma,
      'highlights_generation',
      {
        productId: product.id,
        title: product.title,
        brand: product.brand || cf.brand,
        category: cf.google_product_category,
        industry,
        platform,
        color: cf.color,
        size: cf.size,
        material: cf.material,
      },
      systemPrompt,
      userPrompt,
      product.id,
      forceRefresh
    );

    if (!result || !result.text) {
      throw new Error('Réponse IA vide');
    }

    const parsedHighlights = parseHighlightsResponse(result.text, config.count, config.maxChars);
    const highlights = platform === 'GMC'
      ? buildGmcHighlights(product, parsedHighlights, config.count, config.maxChars)
      : parsedHighlights;

    if (highlights.length === 0) {
      throw new Error('Aucun highlight valide généré');
    }

    return {
      highlights,
      platform,
      industry,
      industryName: industry,
      cached: result.cached || false,
      provider: result.provider || 'gemini',
      cost: result.cost || 0,
    };
  } catch (err) {
    console.warn(`⚠️ Highlights IA échouée pour produit ${product.id}: ${err.message}. Fallback heuristique.`);

    const fallbackHighlights = platform === 'GMC'
      ? buildGmcHighlights(product, [], config.count, config.maxChars)
      : extractHighlightsFallback(product, config.count, config.maxChars);

    return {
      highlights: fallbackHighlights,
      platform,
      industry,
      cached: false,
      fallback: true,
      error: err.message,
    };
  }
}

module.exports = {
  generateHighlightsWithAI,
  detectIndustry,
  PLATFORM_HIGHLIGHTS_CONFIG,
};
