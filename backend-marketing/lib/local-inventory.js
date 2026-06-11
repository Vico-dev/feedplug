// Google Local Inventory Ads (LIA) — logique pure (sans DB) :
// validation des magasins, validation des lignes d'inventaire en masse,
// et construction du flux d'inventaire local par produit × magasin.
// Spec : https://support.google.com/merchants/answer/3061342

const LIA_HEADERS = [
  'store_code',
  'id',
  'quantity',
  'availability',
  'price',
  'sale_price',
  'pickup_method',
  'pickup_sla',
];

const LIA_AVAILABILITIES = ['in stock', 'out of stock', 'limited availability', 'on display to order'];
const LIA_PICKUP_METHODS = ['buy', 'reserve', 'ship to store', 'not supported'];
const LIA_PICKUP_SLAS = ['same day', 'next day', '2-day', '3-day', '4-day', '5-day', '6-day', '7-day', 'multi-week'];

const STORE_CODE_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_INVENTORY_ROWS = 5000;

/** Normalise un code magasin (trim). Retourne null si invalide. */
function normalizeStoreCode(raw) {
  const code = String(raw ?? '').trim();
  return STORE_CODE_REGEX.test(code) ? code : null;
}

/**
 * Valide la création/mise à jour d'un magasin.
 * Retourne { ok: true, value: { storeCode, name, address } } ou { ok: false, error }.
 */
function validateStoreInput(input) {
  const storeCode = normalizeStoreCode(input?.storeCode);
  if (!storeCode) {
    return {
      ok: false,
      error: 'storeCode invalide. Utilisez le code magasin Google Business Profile (1-64 caractères alphanumériques, tirets ou underscores).',
    };
  }
  const name = String(input?.name ?? '').trim().substring(0, 200);
  const address = String(input?.address ?? '').trim().substring(0, 500);
  return { ok: true, value: { storeCode, name: name || null, address: address || null } };
}

/** Déduit la disponibilité LIA d'une quantité. */
function availabilityFromQuantity(quantity) {
  return Number(quantity) > 0 ? 'in stock' : 'out of stock';
}

/**
 * Valide et normalise un lot de lignes d'inventaire
 * [{ storeCode, offerId, quantity, availability?, price?, salePrice?, pickupMethod?, pickupSla? }].
 * Retourne { ok, errors: string[], rows: lignes normalisées }.
 */
function validateInventoryRows(rawRows, options = {}) {
  const maxRows = options.maxRows || MAX_INVENTORY_ROWS;
  const errors = [];
  const rows = [];

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { ok: false, errors: ['rows doit être un tableau non vide.'], rows: [] };
  }
  if (rawRows.length > maxRows) {
    return { ok: false, errors: [`Maximum ${maxRows} lignes par requête (reçu : ${rawRows.length}).`], rows: [] };
  }

  rawRows.forEach((raw, index) => {
    const line = `ligne ${index + 1}`;
    const storeCode = normalizeStoreCode(raw?.storeCode);
    if (!storeCode) {
      errors.push(`${line} : storeCode invalide.`);
      return;
    }
    const offerId = String(raw?.offerId ?? '').trim().substring(0, 50);
    if (!offerId) {
      errors.push(`${line} : offerId requis (id produit du flux).`);
      return;
    }
    const quantity = Number(raw?.quantity);
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
      errors.push(`${line} : quantity doit être un entier >= 0.`);
      return;
    }

    let availability = String(raw?.availability ?? '').trim().toLowerCase() || null;
    if (availability && !LIA_AVAILABILITIES.includes(availability)) {
      errors.push(`${line} : availability invalide ("${availability}"). Valeurs : ${LIA_AVAILABILITIES.join(', ')}.`);
      return;
    }

    const pickupMethod = String(raw?.pickupMethod ?? '').trim().toLowerCase() || null;
    if (pickupMethod && !LIA_PICKUP_METHODS.includes(pickupMethod)) {
      errors.push(`${line} : pickupMethod invalide ("${pickupMethod}"). Valeurs : ${LIA_PICKUP_METHODS.join(', ')}.`);
      return;
    }

    const pickupSla = String(raw?.pickupSla ?? '').trim().toLowerCase() || null;
    if (pickupSla && !LIA_PICKUP_SLAS.includes(pickupSla)) {
      errors.push(`${line} : pickupSla invalide ("${pickupSla}"). Valeurs : ${LIA_PICKUP_SLAS.join(', ')}.`);
      return;
    }
    if (pickupSla && !pickupMethod) {
      errors.push(`${line} : pickupSla nécessite pickupMethod.`);
      return;
    }

    const parsePrice = (value, label) => {
      if (value === undefined || value === null || value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push(`${line} : ${label} doit être un nombre >= 0.`);
        return undefined;
      }
      return Math.round(parsed * 100) / 100;
    };
    const price = parsePrice(raw?.price, 'price');
    if (price === undefined) return;
    const salePrice = parsePrice(raw?.salePrice, 'salePrice');
    if (salePrice === undefined) return;

    rows.push({
      storeCode,
      offerId,
      quantity,
      availability,
      price,
      salePrice,
      pickupMethod,
      pickupSla,
    });
  });

  return { ok: errors.length === 0, errors, rows };
}

/** Formate un prix LIA "12.50 EUR" ; chaîne vide si absent. */
function formatLiaPrice(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return '';
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return '';
  return `${parsed.toFixed(2)} ${currency || 'EUR'}`;
}

/**
 * Construit le flux d'inventaire local : une ligne par produit × magasin.
 *
 * @param {object} params
 * @param {Array} params.items - FeedItems (champs bruts : originid/originId, inventory, currency, customfields)
 * @param {Array} params.stores - magasins actifs [{ storecode }]
 * @param {Array} params.inventories - enregistrements LocalInventory [{ storecode, offerid, quantity, availability, price, saleprice, pickupmethod, pickupsla }]
 * @param {string|null} params.storeCode - si fourni, limite l'export à ce magasin
 * @returns {{ headers: string[], rows: Array<Array<string|number>> }}
 *
 * Sans enregistrement LocalInventory pour un couple (produit, magasin), la
 * quantité retombe sur le stock global du produit (FeedItem.inventory) :
 * cas courant "même stock partout" qui évite un flux vide au démarrage.
 */
function buildLiaRows({ items, stores, inventories, storeCode = null }) {
  const targetStores = (stores || [])
    .map((s) => String(s.storecode ?? s.storeCode ?? '').trim())
    .filter((code) => code && (!storeCode || code === storeCode));

  // Index inventaire : offerId -> (storeCode -> enregistrement)
  const inventoryByOffer = new Map();
  for (const record of inventories || []) {
    const offerId = String(record.offerid ?? record.offerId ?? '').trim();
    const code = String(record.storecode ?? record.storeCode ?? '').trim();
    if (!offerId || !code) continue;
    if (!inventoryByOffer.has(offerId)) inventoryByOffer.set(offerId, new Map());
    inventoryByOffer.get(offerId).set(code, record);
  }

  const rows = [];
  for (const item of items || []) {
    const offerId = String((item.originid ?? item.originId) || item.id || '').substring(0, 50);
    if (!offerId) continue;
    const currency = item.currency || 'EUR';
    const byStore = inventoryByOffer.get(offerId);

    for (const code of targetStores) {
      const record = byStore?.get(code) || null;
      const quantity = record ? Number(record.quantity) || 0 : (Number(item.inventory) || 0);
      const availability = (record && record.availability) || availabilityFromQuantity(quantity);
      rows.push([
        code,
        offerId,
        quantity,
        availability,
        formatLiaPrice(record?.price, currency),
        formatLiaPrice(record?.saleprice ?? record?.salePrice, currency),
        (record && (record.pickupmethod ?? record.pickupMethod)) || '',
        (record && (record.pickupsla ?? record.pickupSla)) || '',
      ]);
    }
  }

  return { headers: [...LIA_HEADERS], rows };
}

module.exports = {
  LIA_HEADERS,
  LIA_AVAILABILITIES,
  LIA_PICKUP_METHODS,
  LIA_PICKUP_SLAS,
  MAX_INVENTORY_ROWS,
  normalizeStoreCode,
  validateStoreInput,
  validateInventoryRows,
  availabilityFromQuantity,
  formatLiaPrice,
  buildLiaRows,
};
