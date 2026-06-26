'use strict';

/**
 * domains/jobs/handlers.js — Handlers de jobs longs / auto-optimisation (bloc 1).
 *
 * EXTRACTION STRANGLER À COMPORTEMENT STRICTEMENT PRÉSERVÉ.
 * Sortis À L'IDENTIQUE de la fonction géante `run()` de server-minimal.js
 * (mêmes debounce, mêmes fallback `.unref()` via lib/jobs.js, même idempotence,
 * mêmes logs). AUCUN changement fonctionnel.
 *
 * Ces handlers appellent beaucoup de fonctions historiquement closure-scoped
 * (`executeGmcPush`, `getActivePlatformConnectionForPush`,
 * `resolveDefaultFeedIdForAccount`, `executeLiaShopifySync`, `getAccountAddonIA`,
 * `checkAiQuota`, `optimizeTitleWithAI`, `optimizeDescriptionWithAI`,
 * `trackAiUsage`, `prisma`, …). Elles sont désormais INJECTÉES via la factory
 * `createJobHandlers(deps)` ci-dessous : `run()` instancie la factory en lui
 * passant les fonctions/état existants, et garde des wrappers locaux de mêmes
 * signatures pour les ~10 appelants (webhooks, ingestions, etc.).
 *
 * `prisma` est un état muté pendant le boot (`let prisma` réassigné). On l'injecte
 * donc via un GETTER `getPrisma()` afin de préserver le late-binding : au moment
 * où un handler s'exécute (après boot), `getPrisma()` renvoie l'instance courante.
 *
 * `runIngestionJob` (bloc ingestion) N'EST PAS extrait ici — il reste dans
 * server-minimal.js. Il est injecté pour que `dispatchJob` puisse le router.
 */

/**
 * @param {object} deps
 * @param {() => any} deps.getPrisma                         - getter late-bind vers l'instance Prisma.
 * @param {Function}  deps.enqueueBackgroundJob              - enqueueJob de lib/jobs.js.
 * @param {object}    deps.JOB_TYPES                         - table des types de jobs.
 * @param {number}    deps.AUTO_GMC_PUSH_DEBOUNCE_MS         - debounce push GMC / LIA.
 * @param {number}    deps.AUTO_OPTIM_DEBOUNCE_MS            - debounce auto-optim.
 * @param {number}    deps.AUTO_OPTIM_BATCH_SIZE             - taille de lot auto-optim.
 * @param {Function}  deps.executeGmcPush                    - push GMC réel.
 * @param {Function}  deps.executeLiaShopifySync             - sync LIA réelle.
 * @param {Function}  deps.getActivePlatformConnectionForPush
 * @param {Function}  deps.resolveDefaultFeedIdForAccount
 * @param {Function}  deps.getAccountAddonIA
 * @param {Function}  deps.checkAiQuota
 * @param {Function}  deps.optimizeTitleWithAI
 * @param {Function}  deps.optimizeDescriptionWithAI
 * @param {Function}  deps.trackAiUsage
 * @param {Function}  [deps.runIngestionJob]                 - handler ingestion (non extrait), pour dispatchJob.
 * @returns {object} handlers + schedulers + dispatchJob
 */
function createJobHandlers(deps) {
  const {
    getPrisma,
    enqueueBackgroundJob,
    JOB_TYPES,
    AUTO_GMC_PUSH_DEBOUNCE_MS,
    AUTO_OPTIM_DEBOUNCE_MS,
    AUTO_OPTIM_BATCH_SIZE,
    executeGmcPush,
    executeLiaShopifySync,
    getActivePlatformConnectionForPush,
    resolveDefaultFeedIdForAccount,
    getAccountAddonIA,
    checkAiQuota,
    optimizeTitleWithAI,
    optimizeDescriptionWithAI,
    trackAiUsage,
  } = deps;

  // ---------------------------------------------------------------------------
  // Sync LIA automatique (fire-and-forget, débouncée par compte) après les
  // ingestions Shopify. No-op si aucun emplacement n'est lié.
  // Sprint 2 : signature publique inchangée. Délègue à enqueueJob.
  function scheduleAutoLiaSync(accountId, reason, delayMs = AUTO_GMC_PUSH_DEBOUNCE_MS) {
    if (!accountId) return;
    enqueueBackgroundJob(
      JOB_TYPES.AUTO_LIA_SYNC,
      { accountId, reason },
      { dedupKey: `${accountId}`, scheduleDelayMs: Math.max(0, delayMs), dedupWindowMs: AUTO_GMC_PUSH_DEBOUNCE_MS }
    ).catch((err) => console.warn(`⚠️ enqueue auto_lia_sync échoué (${reason}):`, err?.message || err));
  }

  // Handler idempotent de la sync LIA. No-op si aucun emplacement lié.
  async function runAutoLiaSync({ accountId, reason }) {
    if (!accountId) return;
    try {
      const result = await executeLiaShopifySync(accountId);
      if (result.synced > 0) {
        console.log(`🏬 Sync LIA auto (${reason}) : ${result.synced} lignes de stock sur ${result.stores} magasin(s)`);
      }
    } catch (err) {
      console.warn(`⚠️ Sync LIA auto (${reason}) échouée pour account ${accountId}:`, err?.message || err);
    }
  }

  // ---------------------------------------------------------------------------
  // Sprint 2 : signature publique inchangée (≈10 appelants). Délègue à enqueueJob
  // (Cloud Tasks en prod → dédup distribuée par nom de tâche ; fallback setTimeout
  // en dev). La `Map` autoGmcPushTimers reste utilisée par le fallback in-process
  // de lib/jobs.js (clé identique), donc le debounce par feed est préservé.
  function scheduleAutoGmcPush(accountId, feedId, reason, delayMs = AUTO_GMC_PUSH_DEBOUNCE_MS) {
    if (!accountId) return;
    const dedupKey = `${accountId}:${feedId || 'default'}`;
    enqueueBackgroundJob(
      JOB_TYPES.AUTO_GMC_PUSH,
      { accountId, feedId: feedId || null, reason },
      { dedupKey, scheduleDelayMs: Math.max(0, delayMs), dedupWindowMs: AUTO_GMC_PUSH_DEBOUNCE_MS }
    ).catch((err) => console.warn(`⚠️ enqueue auto_gmc_push échoué (${reason}):`, err?.message || err));
  }

  // Handler idempotent du push GMC auto. No-op si GMC non connecté ou pas de feed.
  async function runAutoGmcPush({ accountId, feedId, reason }) {
    if (!accountId) return;
    try {
      const conn = await getActivePlatformConnectionForPush(accountId, 'gmc');
      if (!conn || !conn.merchantid) return;
      const targetFeedId = feedId || await resolveDefaultFeedIdForAccount(accountId);
      if (!targetFeedId) return;
      const result = await executeGmcPush({ accountId, userId: null, feedId: targetFeedId });
      console.log(`🔄 Push GMC auto (${reason}) : feed ${targetFeedId} → ${result.succeeded} envoyés, ${result.failed} erreurs`);
    } catch (err) {
      console.warn(`⚠️ Push GMC auto (${reason}) échoué pour account ${accountId}:`, err?.message || err);
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-optim IA après ingestion : sans ce hook, les FeedItems sont pushés
  // sur GMC/Amazon/Meta avec leurs titres et descriptions Shopify bruts.
  // Aucune valeur ajoutée vs un feed direct. Ce scheduler tourne en background
  // (debounce 15s pour absorber les bursts de webhooks) et appelle
  // optimizeTitleWithAI + optimizeDescriptionWithAI sur les items sans
  // customfields.optimized.gmc. Une fois l'optim faite, déclenche
  // automatiquement scheduleAutoGmcPush pour propager les contenus optimisés.

  // Sprint 2 : signature publique inchangée. Délègue à enqueueJob.
  function scheduleAutoOptimization(accountId, feedId, reason, delayMs = AUTO_OPTIM_DEBOUNCE_MS) {
    if (!accountId) return;
    // Pas de feedId connu = fallback direct sur push GMC (le push résoudra le
    // default feed lui-même). On ne peut pas optimiser sans target feed.
    if (!feedId) {
      scheduleAutoGmcPush(accountId, feedId, reason);
      return;
    }
    const dedupKey = `${accountId}:${feedId}`;
    enqueueBackgroundJob(
      JOB_TYPES.AUTO_OPTIMIZATION,
      { accountId, feedId, reason },
      { dedupKey, scheduleDelayMs: Math.max(0, delayMs), dedupWindowMs: AUTO_OPTIM_DEBOUNCE_MS }
    ).catch((err) => console.warn(`⚠️ enqueue auto_optimization échoué (${reason}):`, err?.message || err));
  }

  // Handler idempotent de l'auto-optimisation IA. Re-exécutable : ne ré-optimise
  // que les items sans customfields.optimized.gmc.title, puis push GMC.
  async function runAutoOptimization({ accountId, feedId, reason }) {
    if (!accountId || !feedId) return;
    const prisma = getPrisma();
    {
      try {
        // B1 — pas d'auto-optimisation IA sans pack IA : on pousse le contenu brut.
        const hasIA = await getAccountAddonIA(prisma, accountId);
        if (!hasIA) {
          scheduleAutoGmcPush(accountId, feedId, `${reason} → sans pack IA (push brut)`, 0);
          return;
        }
        const items = await prisma.$queryRawUnsafe(`
          SELECT id, title, descriptiontext, descriptionhtml, brand, sku,
                 customfields, gtin, mpn, price, currency
          FROM "FeedItem"
          WHERE feedid = $1::text
            AND (
              customfields IS NULL
              OR customfields->'optimized'->'gmc'->>'title' IS NULL
              OR customfields->'optimized'->'gmc'->>'title' = ''
            )
          LIMIT ${AUTO_OPTIM_BATCH_SIZE}
        `, feedId);

        if (!items?.length) {
          console.log(`✨ Auto-optim (${reason}) feed ${feedId} : aucun produit à optimiser → push direct`);
          scheduleAutoGmcPush(accountId, feedId, `${reason} → push direct`, 0);
          return;
        }

        // A3 — hard cap texte : au-delà du plafond, on n'appelle PAS Gemini pour
        // l'auto-optimisation — on pousse le contenu brut (comme le chemin sans
        // pack IA). 1 op = titre + description par produit (2 appels), mais on
        // compte 1 op/produit pour rester cohérent avec trackAiUsage plus bas.
        const autoQuota = await checkAiQuota(prisma, accountId, 'text', items.length);
        if (!autoQuota.allowed) {
          console.warn(`⚠️ Auto-optim (${reason}) feed ${feedId} : plafond IA texte atteint (${autoQuota.used}/${autoQuota.cap}) → push brut`);
          scheduleAutoGmcPush(accountId, feedId, `${reason} → plafond IA atteint (push brut)`, 0);
          return;
        }

        let succeeded = 0;
        let failed = 0;
        for (const item of items) {
          try {
            const cf = item.customfields && typeof item.customfields === 'object' ? item.customfields : {};
            const product = {
              id: item.id,
              title: item.title || '',
              description: item.descriptiontext || String(item.descriptionhtml || '').replace(/<[^>]+>/g, ' ').trim(),
              brand: item.brand,
              sku: item.sku,
              gtin: item.gtin,
              mpn: item.mpn,
              price: item.price,
              currency: item.currency,
              customfields: cf,
            };
            const [titleRes, descRes] = await Promise.all([
              optimizeTitleWithAI(prisma, product, { platform: 'GMC' }).catch((e) => {
                console.warn(`⚠️ Auto-optim title ${item.id} :`, e?.message);
                return null;
              }),
              optimizeDescriptionWithAI(prisma, product, { platform: 'GMC' }).catch((e) => {
                console.warn(`⚠️ Auto-optim desc ${item.id} :`, e?.message);
                return null;
              }),
            ]);

            const optimizedTitle = titleRes?.optimizedTitle || product.title;
            const optimizedDescription = descRes?.optimizedDescription || product.description;
            if (!optimizedTitle && !optimizedDescription) {
              failed++;
              continue;
            }

            const payload = {
              title: optimizedTitle,
              description: optimizedDescription,
              optimizedAt: new Date().toISOString(),
            };

            await prisma.$executeRawUnsafe(
              `UPDATE "FeedItem"
               SET customfields = jsonb_set(
                 COALESCE(customfields, '{}'::jsonb),
                 '{optimized,gmc}',
                 $1::jsonb,
                 true
               ),
               updatedat = NOW()
               WHERE id = $2::text`,
              JSON.stringify(payload),
              item.id
            );
            succeeded++;
          } catch (itemErr) {
            console.warn(`⚠️ Auto-optim item ${item.id} échoué :`, itemErr?.message || itemErr);
            failed++;
          }
        }
        console.log(`✨ Auto-optim (${reason}) feed ${feedId} : ${succeeded} optimisés, ${failed} erreurs (sur ${items.length}) → push GMC`);
        // B1 — comptage de la consommation IA (titre + description par produit optimisé).
        trackAiUsage(accountId, succeeded);
        scheduleAutoGmcPush(accountId, feedId, `${reason} → post-optim`, 0);
      } catch (err) {
        console.warn(`⚠️ Auto-optim (${reason}) échoué pour feed ${feedId} :`, err?.message || err);
        // Fallback : push GMC quand même, mieux du brut que rien.
        scheduleAutoGmcPush(accountId, feedId, `${reason} → fallback (optim KO)`, 0);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Routeur de jobs : appelé par le worker HTTP (/internal/jobs/run) ET par le
  // fallback in-process de lib/jobs.js. `runIngestionJob` n'est pas extrait (reste
  // dans server-minimal.js) ; il est injecté paresseusement via deps.runIngestionJob.
  async function dispatchJob(type, payload) {
    payload = payload || {};
    switch (type) {
      case JOB_TYPES.AUTO_GMC_PUSH:
        return runAutoGmcPush(payload);
      case JOB_TYPES.AUTO_OPTIMIZATION:
        return runAutoOptimization(payload);
      case JOB_TYPES.AUTO_LIA_SYNC:
        return runAutoLiaSync(payload);
      case JOB_TYPES.INGESTION_RUN:
        if (typeof deps.runIngestionJob !== 'function') {
          throw new Error('[jobs] runIngestionJob non injecté');
        }
        return deps.runIngestionJob(payload);
      default:
        throw new Error('[jobs] type de job inconnu: ' + type);
    }
  }

  return {
    scheduleAutoLiaSync,
    runAutoLiaSync,
    scheduleAutoGmcPush,
    runAutoGmcPush,
    scheduleAutoOptimization,
    runAutoOptimization,
    dispatchJob,
  };
}

module.exports = { createJobHandlers };
