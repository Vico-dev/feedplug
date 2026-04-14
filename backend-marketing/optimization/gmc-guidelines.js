/**
 * Règles Google Merchant Center pour titres et descriptions
 * Référence : https://support.google.com/merchants/answer/7052112 et 7380908
 * Utilisé par title-optimizer et description-optimizer pour aligner l'IA sur les guidelines.
 */

// Mots/phrases à ne pas mettre dans les titres (contenu promotionnel ou non autorisé)
const PROMOTIONAL_PHRASES_TITLE = [
  'gratuit', 'livraison gratuite', 'promo', 'réduction', 'offre spéciale', 'limited time',
  'soldes', 'destockage', 'prix choc', 'meilleur prix', 'pas cher', 'à ne pas manquer',
  'cliquez ici', 'achetez maintenant', 'offre limitée', 'stock limité'
];

// Mots/phrases à éviter ou atténuer dans les descriptions (claims non vérifiables ou promotionnels)
const PROMOTIONAL_PHRASES_DESC = [
  'meilleur du marché', 'n°1', 'numéro 1', 'le meilleur', 'la meilleure', 'inégalé',
  'livraison gratuite', 'promo', 'soldes', 'cliquez ici', 'achetez maintenant'
];

/** Règles à injecter dans le system prompt pour les titres GMC */
const GMC_TITLE_RULES = `
Règles Google Merchant Center (OBLIGATOIRES) :
- Mettre les informations les plus importantes EN DÉBUT de titre (marque, type, attributs clés) : Google tronque souvent l'affichage.
- Uniquement des faits vérifiables : pas de superlatifs ("le meilleur", "n°1"), pas de contenu promotionnel ("promo", "gratuit", "offre").
- Le titre doit décrire précisément le produit et correspondre à la page produit du site.
- Pas de keyword stuffing : mots-clés naturels, une seule occurrence par concept.
- Maximum 150 caractères. Format recommandé : [Marque] [Type] [Attributs différenciants].
`;

/** Règles à injecter dans le system prompt pour les descriptions GMC */
const GMC_DESCRIPTION_RULES = `
Règles Google Merchant Center pour la description (OBLIGATOIRES) :
- Contenu factuel uniquement : caractéristiques produit, spécifications techniques, attributs visuels.
- Aider l'acheteur à identifier le bon produit (taille, matière, usage, bénéfices réels).
- Pas de contenu promotionnel (promos, prix barrés, "offre limitée", "cliquez ici").
- Pas de claims non vérifiables ("meilleur du marché", "n°1") ; privilégier les faits ("certifié X", "composé de Y").
- Pas de liens externes. Ton professionnel et informatif.
- La description peut être lue par Google pour le référencement : mots-clés naturels, pas de répétition excessive.
- Pour un flux GMC, préférer du texte brut bien rédigé : pas de markdown, pas d'emoji, pas de symboles décoratifs.
- Une description utile est généralement comprise entre 500 et 1000 caractères si les données produit le permettent.
`;

/**
 * Post-traitement titre pour conformité GMC : retirer résidus promotionnels, normaliser majuscules
 * @param {string} title
 * @returns {string}
 */
function applyGmcTitlePostCheck(title) {
  if (!title || typeof title !== 'string') return title;
  let t = title.trim();
  const lower = t.toLowerCase();

  // Retirer phrases promotionnelles (en gardant le reste du titre cohérent)
  for (const phrase of PROMOTIONAL_PHRASES_TITLE) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[,:\\s-]*`, 'gi');
    t = t.replace(re, ' ').replace(/\s+/g, ' ').trim();
  }

  // Éviter tout en majuscules : si plus de 80% des lettres sont en majuscules, mettre en casse phrase
  const letters = t.replace(/\s/g, '').replace(/[^a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g, '');
  if (letters.length >= 5) {
    const upperCount = (t.match(/[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/g) || []).length;
    if (upperCount >= letters.length * 0.8) {
      t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    }
  }

  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Post-traitement description : retirer ou atténuer phrases non conformes GMC (optionnel, léger)
 * @param {string} description
 * @returns {string}
 */
function applyGmcDescriptionPostCheck(description) {
  if (!description || typeof description !== 'string') return description;
  let d = description;

  for (const phrase of PROMOTIONAL_PHRASES_DESC) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    d = d.replace(re, ' '); // espace pour éviter de coller les mots
  }
  d = d
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[\t ]*[✓•*]\s*/gm, '')
    .replace(/^[\t ]*-\s+/gm, '')
    .replace(/^[\t ]*\d+[.)]\s*/gm, '')
    .replace(/^(phrase d'accroche|caracteristiques cles|caractéristiques clés|bénéfices clés|benefices cles|spécifications techniques|specifications techniques|points clés|points cles|paragraphe détaillé|paragraphe detaille)\s*:?\s*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return d;
}

module.exports = {
  GMC_TITLE_RULES,
  GMC_DESCRIPTION_RULES,
  PROMOTIONAL_PHRASES_TITLE,
  PROMOTIONAL_PHRASES_DESC,
  applyGmcTitlePostCheck,
  applyGmcDescriptionPostCheck,
};
