/**
 * Validation et mapping des catégories produit pour Google Merchant Center.
 * - Si google_product_category / product_type sont vides → l'enrichissement les remplit (voir auto-enrichment).
 * - Si fournis → on valide et on peut proposer une catégorie Google plus précise ou mieux mappée.
 */

// Sous-ensemble de catégories Google Product (format officiel "X > Y > Z")
// Permet de valider si une valeur fournie ressemble à une GPC connue et de proposer des mappings
const KNOWN_GOOGLE_PRODUCT_CATEGORIES = [
  'Apparel & Accessories',
  'Apparel & Accessories > Clothing',
  'Apparel & Accessories > Clothing > Dresses',
  'Apparel & Accessories > Clothing > Pants & Shorts',
  'Apparel & Accessories > Clothing > Shirts & Tops',
  'Apparel & Accessories > Clothing > Skirts',
  'Apparel & Accessories > Clothing > Underwear & Socks',
  'Apparel & Accessories > Shoes',
  'Apparel & Accessories > Shoes > Athletic Shoes',
  'Apparel & Accessories > Shoes > Boots',
  'Apparel & Accessories > Shoes > Sandals',
  'Apparel & Accessories > Handbags & Wallets',
  'Apparel & Accessories > Jewelry',
  'Apparel & Accessories > Sunglasses',
  'Electronics',
  'Electronics > Computers',
  'Electronics > Computers > Desktop Computers',
  'Electronics > Computers > Laptops',
  'Electronics > Communications > Telephony',
  'Electronics > Camera & Photo',
  'Electronics > TV & Video',
  'Electronics > Audio',
  'Health & Beauty',
  'Health & Beauty > Personal Care',
  'Health & Beauty > Cosmetics',
  'Health & Beauty > Skin Care',
  'Home & Garden',
  'Home & Garden > Decor',
  'Home & Garden > Kitchen & Dining',
  'Home & Garden > Furniture',
  'Home & Garden > Bedding',
  'Sporting Goods',
  'Sporting Goods > Exercise & Fitness',
  'Sporting Goods > Outdoor Recreation',
  'Toys & Games',
  'Toys & Games > Toys',
  'Toys & Games > Games',
  'Media > Books',
  'Media > Music & Video',
  'Vehicles & Parts',
  'Food & Beverages',
  'Apparel & Accessories > Clothing > Activewear',
  'Apparel & Accessories > Clothing > Coats & Jackets',
  'Apparel & Accessories > Clothing > Swimwear',
  'Hardware',
  'Office Supplies',
  'Luggage & Bags',
  'Baby & Toddler',
  'Pet Supplies',
  'Other'
];

// Mapping : catégories / types fournis par les sources → Google Product Category
// (custom, ERP, PIM, libellés français, etc. → GPC officielle)
const SOURCE_TO_GOOGLE_CATEGORY = {
  // Vêtements & mode
  'vêtements': 'Apparel & Accessories > Clothing',
  'vetements': 'Apparel & Accessories > Clothing',
  'clothing': 'Apparel & Accessories > Clothing',
  'habillement': 'Apparel & Accessories > Clothing',
  'robe': 'Apparel & Accessories > Clothing > Dresses',
  'robes': 'Apparel & Accessories > Clothing > Dresses',
  'pantalon': 'Apparel & Accessories > Clothing > Pants & Shorts',
  'pantalons': 'Apparel & Accessories > Clothing > Pants & Shorts',
  't-shirt': 'Apparel & Accessories > Clothing > Shirts & Tops',
  't-shirt homme': 'Apparel & Accessories > Clothing > Shirts & Tops',
  't-shirt femme': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'chemise': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'chemises': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'pull': 'Apparel & Accessories > Clothing > Shirts & Tops',
  'sweat': 'Apparel & Accessories > Clothing > Activewear',
  'sportswear': 'Apparel & Accessories > Clothing > Activewear',
  'activewear': 'Apparel & Accessories > Clothing > Activewear',
  'manteau': 'Apparel & Accessories > Clothing > Coats & Jackets',
  'veste': 'Apparel & Accessories > Clothing > Coats & Jackets',
  'maillot': 'Apparel & Accessories > Clothing > Swimwear',
  'maillot de bain': 'Apparel & Accessories > Clothing > Swimwear',
  'chaussures': 'Apparel & Accessories > Shoes',
  'chaussure': 'Apparel & Accessories > Shoes',
  'sneakers': 'Apparel & Accessories > Shoes > Athletic Shoes',
  'baskets': 'Apparel & Accessories > Shoes > Athletic Shoes',
  'bottes': 'Apparel & Accessories > Shoes > Boots',
  'sandales': 'Apparel & Accessories > Shoes > Sandals',
  'sacs': 'Apparel & Accessories > Handbags & Wallets',
  'sac à main': 'Apparel & Accessories > Handbags & Wallets',
  'bijoux': 'Apparel & Accessories > Jewelry',
  'lunettes': 'Apparel & Accessories > Sunglasses',
  // Électronique & tech
  'électronique': 'Electronics',
  'electronique': 'Electronics',
  'electronics': 'Electronics',
  'informatique': 'Electronics > Computers',
  'ordinateur': 'Electronics > Computers',
  'laptop': 'Electronics > Computers > Laptops',
  'pc portable': 'Electronics > Computers > Laptops',
  'téléphonie': 'Electronics > Communications > Telephony',
  'telephonie': 'Electronics > Communications > Telephony',
  'téléphone': 'Electronics > Communications > Telephony',
  'smartphone': 'Electronics > Communications > Telephony',
  'photo': 'Electronics > Camera & Photo',
  'appareil photo': 'Electronics > Camera & Photo',
  'tv': 'Electronics > TV & Video',
  'télévision': 'Electronics > TV & Video',
  'audio': 'Electronics > Audio',
  'casque': 'Electronics > Audio',
  // Maison & déco
  'maison': 'Home & Garden',
  'décoration': 'Home & Garden > Decor',
  'decoration': 'Home & Garden > Decor',
  'déco': 'Home & Garden > Decor',
  'cuisine': 'Home & Garden > Kitchen & Dining',
  'meuble': 'Home & Garden > Furniture',
  'meubles': 'Home & Garden > Furniture',
  'literie': 'Home & Garden > Bedding',
  'linge de maison': 'Home & Garden > Bedding',
  // Beauté & santé
  'beauté': 'Health & Beauty > Personal Care',
  'beaute': 'Health & Beauty > Personal Care',
  'cosmétique': 'Health & Beauty > Cosmetics',
  'cosmetique': 'Health & Beauty > Cosmetics',
  'soin': 'Health & Beauty > Skin Care',
  'parfum': 'Health & Beauty > Cosmetics',
  // Sport, jouets, autres
  'sport': 'Sporting Goods',
  'sporting': 'Sporting Goods',
  'fitness': 'Sporting Goods > Exercise & Fitness',
  'jouets': 'Toys & Games > Toys',
  'jouet': 'Toys & Games > Toys',
  'jeu': 'Toys & Games > Games',
  'livres': 'Media > Books',
  'livre': 'Media > Books',
  'véhicule': 'Vehicles & Parts',
  'alimentation': 'Food & Beverages',
  'bébé': 'Baby & Toddler',
  'bebe': 'Baby & Toddler',
  'animal': 'Pet Supplies',
  'bricolage': 'Hardware',
  'bureau': 'Office Supplies',
  'bagagerie': 'Luggage & Bags',
  'valise': 'Luggage & Bags'
};

/**
 * Normalise une chaîne pour la comparaison (minuscules, trim, accents légers)
 */
function normalizeForMatch(str) {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '');
}

/**
 * Vérifie si la valeur ressemble à une Google Product Category (format "X > Y > Z")
 */
function looksLikeGoogleProductCategory(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.includes(' > ') && trimmed.length >= 5 && trimmed.length <= 200;
}

/**
 * Trouve la catégorie Google connue la plus proche (même chaîne ou préfixe)
 */
function findClosestKnownGPC(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = normalizeForMatch(value);
  // Correspondance exacte
  for (const gpc of KNOWN_GOOGLE_PRODUCT_CATEGORIES) {
    if (normalizeForMatch(gpc) === normalized) return gpc;
  }
  // Correspondance par préfixe (ex. "Apparel & Accessories > Clothing" pour "Apparel & Accessories > Clothing > T-Shirts")
  for (const gpc of KNOWN_GOOGLE_PRODUCT_CATEGORIES) {
    if (normalized.startsWith(normalizeForMatch(gpc) + ' > ') || normalized === normalizeForMatch(gpc)) {
      return gpc;
    }
  }
  // La valeur contient " > " mais n'est pas dans la liste : on la garde telle quelle (catégorie peut-être plus précise)
  if (value.includes(' > ')) return value.trim();
  return null;
}

/**
 * Mappe une catégorie source (custom, ERP, français) vers une Google Product Category
 */
function mapSourceToGoogleCategory(sourceValue) {
  if (!sourceValue || typeof sourceValue !== 'string') return null;
  const normalized = normalizeForMatch(sourceValue);
  if (!normalized) return null;
  // Correspondance exacte dans le mapping
  for (const [key, gpc] of Object.entries(SOURCE_TO_GOOGLE_CATEGORY)) {
    if (normalizeForMatch(key) === normalized) return gpc;
  }
  // Correspondance partielle : la source contient un mot-clé (clés longues en premier)
  const entries = Object.entries(SOURCE_TO_GOOGLE_CATEGORY).sort((a, b) => b[0].length - a[0].length);
  for (const [key, gpc] of entries) {
    const keyNorm = normalizeForMatch(key);
    if (keyNorm.length >= 3 && normalized.includes(keyNorm)) return gpc;
  }
  return null;
}

/**
 * Valide ou mappe google_product_category.
 * - Si vide → shouldEnrich = true (l'enrichissement doit le remplir).
 * - Si fourni → on vérifie si c'est une GPC valide ou on mappe vers la plus proche.
 * @returns { suggested: string|null, source: 'missing'|'exact'|'mapped'|'suggested', shouldEnrich: boolean, message?: string }
 */
function validateOrMapGoogleCategory(existingValue, item) {
  const trimmed = existingValue && typeof existingValue === 'string' ? existingValue.trim() : '';
  if (!trimmed) {
    return {
      suggested: null,
      source: 'missing',
      shouldEnrich: true,
      message: 'Catégorie absente : l\'enrichissement FeedPlug peut la déduire ou la remplir via l\'IA.'
    };
  }

  if (looksLikeGoogleProductCategory(trimmed)) {
    const closest = findClosestKnownGPC(trimmed);
    if (closest && closest !== trimmed) {
      return {
        suggested: closest,
        source: 'suggested',
        shouldEnrich: true,
        message: `Catégorie mappée vers une catégorie Google reconnue : "${closest}"`
      };
    }
    return {
      suggested: trimmed,
      source: 'exact',
      shouldEnrich: false,
      message: 'Catégorie déjà au format Google Product Category.'
    };
  }

  const mapped = mapSourceToGoogleCategory(trimmed);
  if (mapped) {
    return {
      suggested: mapped,
      source: 'mapped',
      shouldEnrich: true,
      message: `Catégorie source "${trimmed}" mappée vers la catégorie Google : "${mapped}"`
    };
  }

  return {
    suggested: null,
    source: 'unknown',
    shouldEnrich: true,
    message: `Catégorie "${trimmed}" non reconnue : l'enrichissement (règles ou IA) peut proposer une catégorie Google adaptée.`
  };
}

/**
 * Valide ou normalise product_type.
 * - Si vide → shouldEnrich = true.
 * - Si fourni → on peut le garder ou suggérer un type plus standard.
 */
function validateOrMapProductType(existingValue, item) {
  const trimmed = existingValue && typeof existingValue === 'string' ? existingValue.trim() : '';
  if (!trimmed) {
    return {
      suggested: null,
      source: 'missing',
      shouldEnrich: true,
      message: 'Type de produit absent : l\'enrichissement peut le déduire du titre ou de la catégorie.'
    };
  }
  return {
    suggested: trimmed,
    source: 'exact',
    shouldEnrich: false,
    message: 'Type de produit déjà renseigné.'
  };
}

module.exports = {
  validateOrMapGoogleCategory,
  validateOrMapProductType,
  mapSourceToGoogleCategory,
  findClosestKnownGPC,
  looksLikeGoogleProductCategory,
  KNOWN_GOOGLE_PRODUCT_CATEGORIES,
  SOURCE_TO_GOOGLE_CATEGORY
};
