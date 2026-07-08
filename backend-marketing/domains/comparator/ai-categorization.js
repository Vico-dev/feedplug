'use strict';

/**
 * domains/comparator/ai-categorization.js — Enrichissement IA du catalogue comparateur.
 *
 * Complète la catégorisation par mots-clés (categorization.js) : les produits que
 * les regex ne savent pas classer (ProductGroup.category IS NULL) sont envoyés
 * PAR LOTS à Gemini — 1 appel = `batchSize` produits, réponse JSON stricte —
 * qui déduit la catégorie (taxonomie maison UNIQUEMENT) + les attributs
 * manquants (couleur pour commencer).
 *
 * Écritures identiques à categorization.js : UPSERT "ProductGroupCategory"
 * (source 'ai', confiance 60 — sous 'awin_map' 80 et au-dessus de 'keyword' 50
 * en fraîcheur seulement, jamais en écrasement : on ne traite QUE le non-classé)
 * + dénormalisation ProductGroup.category. Couleur → ProductGroup.attributes
 * (jsonb, merge non destructif : la donnée flux reste prioritaire).
 *
 * Garanties : borné (limit/batchSize), idempotent, no-op propre sans
 * GEMINI_API_KEY, un lot en échec n'interrompt pas les suivants.
 * Conventions repo : fonctions pures testables + SQL brut via $queryRawUnsafe,
 * `prisma` injecté, colonnes minuscules. `fetchImpl` injectable (tests).
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LIMIT = 200;
const AI_CONFIDENCE = 60;

/** Prompt d'un lot : catégories autorisées + produits numérotés → JSON strict. PUR. */
function buildBatchPrompt(products, categories) {
  const catLines = categories.map((c) => `- ${c.id} (${c.labelfr})`).join('\n');
  const prodLines = products
    .map((p, i) => `${i}. titre: ${String(p.title || '').slice(0, 160)} | marque: ${String(p.brand || '') || '?'}`)
    .join('\n');
  return `Tu classes des produits e-commerce dans une taxonomie fermée et tu déduis leur couleur principale.

Catégories AUTORISÉES (utilise exactement ces identifiants) :
${catLines}

Produits :
${prodLines}

Réponds UNIQUEMENT avec un tableau JSON (aucun texte autour), un objet par produit :
[{"i": <numéro du produit>, "cat": "<identifiant de catégorie ou null si aucune ne convient>", "color": "<couleur principale en français en minuscules (ex: noir, bleu marine) ou null si indéterminable>"}]

Règles : "cat" DOIT être un identifiant de la liste ou null — jamais autre chose. Ne devine pas une couleur absente du titre.`;
}

/** Extrait le premier tableau JSON d'une réponse LLM (tolère les fences \`\`\`). PUR. */
function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

/**
 * Valide/assainit la sortie LLM : index dans le lot, catégorie dans la liste
 * blanche (sinon null), couleur plausible (lettres/espaces/tirets, ≤ 32 car.).
 * PUR. Retourne [{ index, categoryId, color }].
 */
function validateResults(raw, { count, validCats }) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const index = Number(r.i);
    if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) continue;
    seen.add(index);
    const cat = typeof r.cat === 'string' && validCats.has(r.cat.trim()) ? r.cat.trim() : null;
    let color = null;
    if (typeof r.color === 'string') {
      const c = r.color.trim().toLowerCase();
      if (c && c !== 'null' && c.length <= 32 && /^[a-zà-ÿ][a-zà-ÿ' -]*$/i.test(c)) color = c;
    }
    if (cat || color) out.push({ index, categoryId: cat, color });
  }
  return out;
}

/** Appel Gemini generateContent → texte de réponse (jette en cas d'erreur HTTP). */
async function callGemini(fetchImpl, apiKey, model, prompt) {
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Réponse Gemini vide');
  return text;
}

/** Produits sans catégorie (cible de l'enrichissement), optionnellement restreints. */
async function findCandidates(prisma, { groupIds = null, limit = DEFAULT_LIMIT } = {}) {
  const filter = Array.isArray(groupIds) && groupIds.length ? 'AND pg.id = ANY($1::text[])' : '';
  const params = filter ? [groupIds] : [];
  return prisma.$queryRawUnsafe(
    `SELECT pg.id, pg.canonicaltitle AS title, pg.brand,
            COALESCE(pg.attributes->>'color', '') AS color
     FROM "ProductGroup" pg
     WHERE pg.category IS NULL ${filter}
     ORDER BY pg.updatedat DESC
     LIMIT ${Number(limit)}`,
    ...params,
  );
}

/**
 * Boucle d'enrichissement par lots. Retourne des compteurs (+ skipped si no-op).
 * @param {Object} opts { groupIds?, limit?, batchSize?, apiKey?, model?, fetchImpl? }
 */
async function runAiEnrichment(prisma, opts = {}) {
  const apiKey = opts.apiKey !== undefined ? opts.apiKey : process.env.GEMINI_API_KEY;
  if (!apiKey) return { skipped: true, reason: 'no_api_key', processed: 0, categorized: 0, colored: 0, failedBatches: 0 };

  const fetchImpl = opts.fetchImpl || fetch;
  const model = opts.model || DEFAULT_MODEL;
  const batchSize = Math.max(1, Math.min(50, Number(opts.batchSize) || DEFAULT_BATCH_SIZE));
  const limit = Math.max(1, Math.min(2000, Number(opts.limit) || DEFAULT_LIMIT));

  const cats = await prisma.$queryRawUnsafe(
    `SELECT id, labelfr FROM "ComparatorCategory" WHERE active = true ORDER BY position ASC`,
  );
  if (!cats.length) return { skipped: true, reason: 'no_taxonomy', processed: 0, categorized: 0, colored: 0, failedBatches: 0 };
  const validCats = new Set(cats.map((c) => c.id));

  const candidates = await findCandidates(prisma, { groupIds: opts.groupIds, limit });
  let categorized = 0;
  let colored = 0;
  let failedBatches = 0;

  for (let at = 0; at < candidates.length; at += batchSize) {
    const batch = candidates.slice(at, at + batchSize);
    let results;
    try {
      const text = await callGemini(fetchImpl, apiKey, model, buildBatchPrompt(batch, cats));
      results = validateResults(extractJson(text), { count: batch.length, validCats });
    } catch (e) {
      failedBatches++;
      console.warn(`[ai-enrich] lot ${at / batchSize + 1} en échec:`, e.message);
      continue; // un lot raté n'interrompt pas les suivants
    }

    for (const r of results) {
      const group = batch[r.index];
      if (r.categoryId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "ProductGroupCategory" (groupid, categoryid, confidence, source, updatedat)
           VALUES ($1::text, $2::text, $3::int, 'ai', now())
           ON CONFLICT (groupid) DO UPDATE SET categoryid = EXCLUDED.categoryid, confidence = EXCLUDED.confidence, source = 'ai', updatedat = now()`,
          group.id, r.categoryId, AI_CONFIDENCE,
        );
        await prisma.$executeRawUnsafe(
          `UPDATE "ProductGroup" SET category = $2::text WHERE id = $1::text AND category IS NULL`,
          group.id, r.categoryId,
        );
        categorized++;
      }
      // Merge non destructif : ne pose la couleur que si le flux n'en a pas déjà une.
      if (r.color && !group.color) {
        await prisma.$executeRawUnsafe(
          `UPDATE "ProductGroup"
           SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object('color', $2::text)
           WHERE id = $1::text AND COALESCE(attributes->>'color', '') = ''`,
          group.id, r.color,
        );
        colored++;
      }
    }
  }

  return { skipped: false, processed: candidates.length, categorized, colored, failedBatches };
}

module.exports = {
  buildBatchPrompt,
  extractJson,
  validateResults,
  findCandidates,
  runAiEnrichment,
  DEFAULT_MODEL,
  AI_CONFIDENCE,
};
