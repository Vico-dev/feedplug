export type MappingField = { key: string; label: string; required?: boolean };
export type MappingFieldGroup = { group: string; fields: MappingField[] };
export type MappingOutputChannel = 'gmc' | 'meta' | 'amazon' | 'all';

const UNIVERSAL_MAPPING_FIELDS_GROUPS: MappingFieldGroup[] = [
  {
    group: 'Identité produit',
    fields: [
      { key: 'id', label: 'Identifiant produit', required: false },
      { key: 'sku', label: 'SKU / Référence', required: false },
      { key: 'title', label: 'Titre', required: true },
      { key: 'description', label: 'Description', required: false },
      { key: 'link', label: 'URL du produit', required: false },
      { key: 'mobile_link', label: 'URL mobile', required: false },
    ],
  },
  {
    group: 'Images',
    fields: [
      { key: 'image_link', label: "URL de l'image principale", required: false },
      { key: 'additional_image_link', label: 'Images additionnelles', required: false },
    ],
  },
  {
    group: 'Prix, stock et disponibilité',
    fields: [
      { key: 'price', label: 'Prix', required: true },
      { key: 'sale_price', label: 'Prix promo', required: false },
      { key: 'sale_price_effective_date', label: 'Dates de la promo', required: false },
      { key: 'availability', label: 'Disponibilité', required: false },
      { key: 'availability_date', label: 'Date de disponibilité', required: false },
      { key: 'quantity', label: 'Quantité', required: false },
      { key: 'inventory', label: 'Quantité en stock', required: false },
      { key: 'cost_of_goods_sold', label: 'Coût des marchandises', required: false },
      { key: 'expiration_date', label: "Date d'expiration", required: false },
    ],
  },
  {
    group: 'Identifiants commerciaux',
    fields: [
      { key: 'brand', label: 'Marque', required: false },
      { key: 'gtin', label: 'GTIN / EAN / Code-barres', required: false },
      { key: 'mpn', label: 'Référence fabricant (MPN)', required: false },
      { key: 'identifier_exists', label: 'Identifiant existe', required: false },
      { key: 'asin', label: 'ASIN', required: false },
      { key: 'isbn', label: 'ISBN', required: false },
      { key: 'upc', label: 'UPC', required: false },
      { key: 'ean', label: 'EAN', required: false },
    ],
  },
  {
    group: 'Catégorie et variantes',
    fields: [
      { key: 'google_product_category', label: 'Catégorie Google', required: false },
      { key: 'product_type', label: 'Type de produit', required: false },
      { key: 'item_group_id', label: 'ID groupe (variantes)', required: false },
      { key: 'color', label: 'Couleur', required: false },
      { key: 'size', label: 'Taille', required: false },
      { key: 'size_type', label: 'Type de taille', required: false },
      { key: 'size_system', label: 'Système de tailles', required: false },
      { key: 'material', label: 'Matière', required: false },
      { key: 'pattern', label: 'Motif', required: false },
      { key: 'gender', label: 'Genre', required: false },
      { key: 'age_group', label: "Tranche d'âge", required: false },
      { key: 'condition', label: 'État (neuf, occasion...)', required: false },
      { key: 'multipack', label: 'Multipack', required: false },
      { key: 'is_bundle', label: 'Produit bundle', required: false },
      { key: 'adult', label: 'Contenu adulte', required: false },
    ],
  },
  {
    group: 'Livraison et retrait',
    fields: [
      { key: 'shipping', label: 'Expédition', required: false },
      { key: 'shipping_label', label: 'Label d’expédition', required: false },
      { key: 'shipping_weight', label: 'Poids', required: false },
      { key: 'shipping_length', label: 'Longueur', required: false },
      { key: 'shipping_width', label: 'Largeur', required: false },
      { key: 'shipping_height', label: 'Hauteur', required: false },
      { key: 'max_handling_time', label: 'Délai préparation max', required: false },
      { key: 'min_handling_time', label: 'Délai préparation min', required: false },
      { key: 'transit_time_label', label: 'Délai de livraison', required: false },
      { key: 'pickup_method', label: 'Méthode de retrait', required: false },
      { key: 'pickup_SLA', label: 'SLA retrait', required: false },
    ],
  },
  {
    group: 'Tarification avancée et conformité',
    fields: [
      { key: 'tax', label: 'Taxe', required: false },
      { key: 'tax_category', label: 'Catégorie taxe', required: false },
      { key: 'promotion_id', label: 'ID promotion', required: false },
      { key: 'unit_pricing_measure', label: 'Mesure de prix unitaire', required: false },
      { key: 'unit_pricing_base_measure', label: 'Base de prix unitaire', required: false },
      { key: 'excluded_destination', label: 'Destination exclue', required: false },
      { key: 'included_destination', label: 'Destination incluse', required: false },
      { key: 'product_tax_code', label: 'Code taxe produit', required: false },
    ],
  },
  {
    group: 'Énergie, fidélité et labels',
    fields: [
      { key: 'energy_efficiency_class', label: 'Classe énergétique', required: false },
      { key: 'min_energy_efficiency_class', label: 'Classe min énergétique', required: false },
      { key: 'max_energy_efficiency_class', label: 'Classe max énergétique', required: false },
      { key: 'loyalty_program', label: 'Programme de fidélité', required: false },
      { key: 'loyalty_program_program_label', label: 'Label programme fidélité', required: false },
      { key: 'loyalty_program_tier_label', label: 'Label niveau fidélité', required: false },
      { key: 'loyalty_program_price', label: 'Prix membre', required: false },
      { key: 'loyalty_program_loyalty_points', label: 'Points fidélité', required: false },
      { key: 'loyalty_program_member_price_effective_date', label: 'Dates prix membre', required: false },
      { key: 'loyalty_program_shipping_label', label: 'Label expédition membre', required: false },
      { key: 'loyalty_program_cashback_for_future_use', label: 'Cashback fidélité', required: false },
      { key: 'custom_label_0', label: 'Label personnalisé 0', required: false },
      { key: 'custom_label_1', label: 'Label personnalisé 1', required: false },
      { key: 'custom_label_2', label: 'Label personnalisé 2', required: false },
      { key: 'custom_label_3', label: 'Label personnalisé 3', required: false },
      { key: 'custom_label_4', label: 'Label personnalisé 4', required: false },
    ],
  },
  {
    group: 'Attributs marketplaces et contenu',
    fields: [
      { key: 'bullet_point_1', label: 'Bullet point 1', required: false },
      { key: 'bullet_point_2', label: 'Bullet point 2', required: false },
      { key: 'bullet_point_3', label: 'Bullet point 3', required: false },
      { key: 'bullet_point_4', label: 'Bullet point 4', required: false },
      { key: 'bullet_point_5', label: 'Bullet point 5', required: false },
    ],
  },
];

const META_MAPPING_FIELDS_GROUPS: MappingFieldGroup[] = [
  {
    group: 'Catalogue Meta (Facebook / Instagram)',
    fields: [
      { key: 'id', label: 'ID produit', required: true },
      { key: 'title', label: 'Titre', required: true },
      { key: 'description', label: 'Description', required: true },
      { key: 'link', label: 'URL du produit', required: true },
      { key: 'image_link', label: "URL de l'image", required: true },
      { key: 'availability', label: 'Disponibilité', required: true },
      { key: 'condition', label: 'État (condition)', required: true },
      { key: 'price', label: 'Prix', required: true },
      { key: 'brand', label: 'Marque', required: false },
      { key: 'gtin', label: 'GTIN / EAN', required: false },
      { key: 'mpn', label: 'MPN', required: false },
      { key: 'sale_price', label: 'Prix promotionnel', required: false },
      { key: 'additional_image_link', label: 'Images additionnelles', required: false },
      { key: 'google_product_category', label: 'Catégorie', required: false },
      { key: 'product_type', label: 'Type de produit', required: false },
      { key: 'inventory', label: 'Stock', required: false },
      { key: 'custom_label_0', label: 'Label personnalisé 0', required: false },
      { key: 'custom_label_1', label: 'Label personnalisé 1', required: false },
      { key: 'custom_label_2', label: 'Label personnalisé 2', required: false },
      { key: 'custom_label_3', label: 'Label personnalisé 3', required: false },
      { key: 'custom_label_4', label: 'Label personnalisé 4', required: false },
    ],
  },
];

const AMAZON_MAPPING_FIELDS_GROUPS: MappingFieldGroup[] = [
  {
    group: 'Export Amazon',
    fields: [
      { key: 'id', label: 'ID / SKU produit', required: true },
      { key: 'sku', label: 'SKU', required: false },
      { key: 'asin', label: 'ASIN', required: false },
      { key: 'title', label: 'Nom du produit (item_name)', required: true },
      { key: 'description', label: 'Description produit', required: false },
      { key: 'link', label: 'URL produit', required: false },
      { key: 'image_link', label: 'URL image principale', required: true },
      { key: 'additional_image_link', label: 'Images additionnelles', required: false },
      { key: 'price', label: 'Prix', required: true },
      { key: 'sale_price', label: 'Prix promotionnel', required: false },
      { key: 'brand', label: 'Marque', required: false },
      { key: 'gtin', label: 'GTIN / EAN', required: false },
      { key: 'mpn', label: 'MPN', required: false },
      { key: 'condition', label: 'État (condition_type)', required: false },
      { key: 'availability', label: 'Disponibilité', required: false },
      { key: 'inventory', label: 'Quantité / stock', required: false },
      { key: 'bullet_point_1', label: 'Bullet point 1', required: false },
      { key: 'bullet_point_2', label: 'Bullet point 2', required: false },
      { key: 'bullet_point_3', label: 'Bullet point 3', required: false },
      { key: 'bullet_point_4', label: 'Bullet point 4', required: false },
      { key: 'bullet_point_5', label: 'Bullet point 5', required: false },
      { key: 'product_type', label: 'Type de produit', required: false },
      { key: 'item_group_id', label: 'ID parent / variation', required: false },
    ],
  },
];

export const CHANNEL_OPTIONS: { id: MappingOutputChannel; label: string; fieldGroups: MappingFieldGroup[] }[] = [
  { id: 'gmc', label: 'Google Merchant Center (Google Shopping)', fieldGroups: UNIVERSAL_MAPPING_FIELDS_GROUPS },
  { id: 'meta', label: 'Meta (Facebook / Instagram Catalogue)', fieldGroups: META_MAPPING_FIELDS_GROUPS },
  { id: 'amazon', label: 'Amazon', fieldGroups: AMAZON_MAPPING_FIELDS_GROUPS },
  { id: 'all', label: 'Tous les canaux (mapping complet)', fieldGroups: UNIVERSAL_MAPPING_FIELDS_GROUPS },
];

export const MAPPING_FIELDS_GROUPS = UNIVERSAL_MAPPING_FIELDS_GROUPS;
export const ALL_MAPPING_FIELDS = UNIVERSAL_MAPPING_FIELDS_GROUPS.flatMap((group) =>
  group.fields.map((field) => ({ ...field, group: group.group }))
);

export function getMappingFieldsForChannel(channel: MappingOutputChannel): Array<MappingField & { group: string }> {
  const config = CHANNEL_OPTIONS.find((entry) => entry.id === channel) || CHANNEL_OPTIONS[0];
  return config.fieldGroups.flatMap((group) => group.fields.map((field) => ({ ...field, group: group.group })));
}
