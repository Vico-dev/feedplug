'use strict';
// Classement d'un ProductGroup dans la taxonomie maison (10 catégories).
// Signal 1 : catégorie AWIN (depuis FeedItem.customfields). Signal 2 : mots-clés titre/marque.
// Fonctions pures testables + un runner DB idempotent (UPSERT).

function strip(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Ordre = priorité (premier match gagne). Catégories = ids de ComparatorCategory.
const KEYWORDS = [
  ['jeux-video', /\b(nintendo|switch|playstation|ps5|ps4|xbox|console|manette|gamepad|jeu video|jeux video|steam deck)\b/],
  ['informatique', /\b(ordinateurs?|laptops?|pc portable|macbook|claviers?|souris|ecrans?|moniteurs?|ssd|disques? durs?|webcams?|imprimantes?|routeurs?|cle usb|computing|acer|asus|lenovo|nvidia|processeurs?)\b/],
  ['telephonie', /\b(smartphone|telephone|iphone|galaxy|coque|ecouteurs|airpods|tablette|ipad|chargeur)\b/],
  ['tv-son', /\b(televiseur|television|barre de son|enceinte|casque audio|home cinema|videoprojecteur|hifi|soundbar)\b/],
  ['electromenager', /\b(refrigerateur|frigo|lave-linge|lave linge|lave-vaisselle|micro-ondes|four|aspirateur|cafetiere|seche-linge|robot cuiseur)\b/],
  ['beaute-parfums', /\b(parfum|eau de parfum|eau de toilette|cosmetique|maquillage|soin visage|shampoing|creme)\b/],
  ['mode', /\b(chaussure|basket|sneaker|t-shirt|tee-shirt|robe|pantalon|jean|veste|manteau|sac a main|maroquinerie|sac|montre|bijou|collier|bracelet|bague|lunettes)\b/],
  ['maison-deco', /\b(canape|meuble|table|chaise|lampe|rideau|tapis|matelas|coussin|deco|jardin|outillage|perceuse|bricolage)\b/],
  ['sport', /\b(velo|fitness|musculation|halter|yoga|running|tennis|football|randonnee|camping|trottinette)\b/],
  ['jouets', /\b(jouet|lego|playmobil|poupee|peluche|puzzle)\b/],
];

/** Catégorie AWIN brute → catégorie maison (mot-clé sur la chaîne AWIN). */
function fromAwinCategory(awinCat) {
  const c = strip(awinCat);
  if (!c) return null;
  for (const [cat, re] of KEYWORDS) if (re.test(c)) return cat;
  return null;
}

/** Retourne { categoryId, confidence, source } ou null. */
function classify({ title, brand, awinCategory } = {}) {
  const fromAwin = fromAwinCategory(awinCategory);
  if (fromAwin) return { categoryId: fromAwin, confidence: 80, source: 'awin_map' };
  const hay = strip(`${title || ''} ${brand || ''}`);
  for (const [cat, re] of KEYWORDS) if (re.test(hay)) return { categoryId: cat, confidence: 50, source: 'keyword' };
  return null;
}

/**
 * Classe les ProductGroup (UPSERT idempotent dans ProductGroupCategory + dénormalise sur ProductGroup.category).
 * opts.groupIds : restreindre à certains groupes (post-ingestion) ; sinon tout le stock.
 */
async function categorizeGroups(prisma, { groupIds = null, limit = 50000 } = {}) {
  const filter = Array.isArray(groupIds) && groupIds.length
    ? `WHERE pg.id = ANY($1::text[])`
    : '';
  const params = filter ? [groupIds] : [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT pg.id, pg.canonicaltitle AS title, pg.brand,
            (SELECT fi.customfields->>'category_name' FROM "FeedItem" fi
             WHERE fi.groupid = pg.id AND fi.customfields->>'category_name' IS NOT NULL LIMIT 1) AS awincat
     FROM "ProductGroup" pg ${filter} LIMIT ${Number(limit)}`,
    ...params,
  );
  let classified = 0, skipped = 0;
  for (const r of rows) {
    const res = classify({ title: r.title, brand: r.brand, awinCategory: r.awincat });
    if (!res) { skipped++; continue; }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ProductGroupCategory" (groupid, categoryid, confidence, source, updatedat)
       VALUES ($1::text, $2::text, $3::int, $4::text, now())
       ON CONFLICT (groupid) DO UPDATE SET categoryid = EXCLUDED.categoryid, confidence = EXCLUDED.confidence, source = EXCLUDED.source, updatedat = now()`,
      r.id, res.categoryId, res.confidence, res.source,
    );
    await prisma.$executeRawUnsafe(`UPDATE "ProductGroup" SET category = $2::text WHERE id = $1::text`, r.id, res.categoryId);
    classified++;
  }
  return { total: rows.length, classified, skipped };
}

module.exports = { strip, fromAwinCategory, classify, categorizeGroups, KEYWORDS };
