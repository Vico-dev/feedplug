/**
 * Shopify app lifecycle handlers — uninstall + webhook subscription matching.
 *
 * Extrait de server-minimal.js pour permettre les tests unitaires.
 * Les fonctions ici sont des handlers purs : elles ne touchent qu'à la base
 * via le prisma passé en argument et ne dépendent pas du module-level state.
 */

/**
 * Gère le webhook app/uninstalled :
 *  - PAUSE toutes les FeedSource SHOPIFY liées au shop (status check accepte
 *    seulement ACTIVE/PAUSED/ERROR — d'où PAUSED et non un faux INACTIVE).
 *  - CANCEL toutes les shopify_subscriptions PENDING ou ACTIVE pour ce shop,
 *    en posant cancelled_at = NOW().
 *
 * Pas de suppression : on garde Credential + Feed + FeedItem pour permettre
 * une reprise rapide si le merchant réinstalle. Le webhook `shop/redact`
 * (déclenché 48h après uninstall si vraiment abandon) fait le hard delete.
 *
 * @param {object} opts
 * @param {object} opts.prisma                  Prisma client (avec $executeRawUnsafe)
 * @param {string} opts.shopDomain              ex: "demo.myshopify.com"
 * @param {string} [opts.appId]                 'listed' | 'connector' : scope la
 *                                              PAUSE aux Credentials de cette app
 *                                              (une boutique peut avoir les deux).
 *                                              Si absent, scope sur le shop seul
 *                                              (rétro-compat).
 * @param {boolean} [opts.cancelSubscriptions=true] N'annule les abonnements du
 *                                              shop que pour une app facturée.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function handleAppUninstalled({ prisma, shopDomain, appId, cancelSubscriptions = true }) {
  if (!shopDomain) {
    return { ok: false, error: 'shopDomain manquant' };
  }
  if (!prisma) {
    return { ok: false, error: 'prisma indisponible' };
  }

  try {
    // Scope par appId si fourni : on ne met en PAUSE que les sources liées aux
    // Credentials de l'app qui se désinstalle (tag secretjson->>'appId').
    // Les credentials legacy sans appId sont traités comme 'listed'.
    if (appId) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "FeedSource"
          SET status = 'PAUSED'::text,
              updatedat = NOW()
          WHERE connector = 'SHOPIFY'::text
            AND credentialid IN (
              SELECT id
              FROM "Credential"
              WHERE connector = 'SHOPIFY'::text
                AND secretjson->>'shop' = $1::text
                AND COALESCE(secretjson->>'appId', 'listed') = $2::text
            )
        `,
        shopDomain,
        appId,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          UPDATE "FeedSource"
          SET status = 'PAUSED'::text,
              updatedat = NOW()
          WHERE connector = 'SHOPIFY'::text
            AND credentialid IN (
              SELECT id
              FROM "Credential"
              WHERE connector = 'SHOPIFY'::text
                AND secretjson->>'shop' = $1::text
            )
        `,
        shopDomain,
      );
    }
    if (cancelSubscriptions) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE shopify_subscriptions
          SET status = 'CANCELLED'::text,
              cancelled_at = NOW(),
              updatedat = NOW()
          WHERE shop_domain = $1::text
            AND status IN ('PENDING', 'ACTIVE')
        `,
        shopDomain,
      );
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

/**
 * Matching de la subscription Shopify reçue par webhook app_subscriptions/update.
 *
 * Cas Managed Pricing : le premier webhook ACTIVE arrive avec un
 * shopify_subscription_id (gid://shopify/AppSubscription/...) qu'on n'a jamais
 * vu (à /subscribe on avait stocké un id provisoire `pending_...`).
 *
 * Cette fonction trouve la row PENDING locale qui correspond et la promeut :
 *  1. Si la row existe déjà avec ce shopify_subscription_id → rien à faire ici.
 *  2. Sinon, cherche la dernière row PENDING pour ce shop avec plan_key matchant
 *     le `name` Shopify (uppercase), et remplace son shopify_subscription_id.
 *
 * @param {object} opts
 * @param {object} opts.prisma
 * @param {string} opts.shopifySubscriptionId  ex: "gid://shopify/AppSubscription/123"
 * @param {string} opts.shopDomain             ex: "demo.myshopify.com"
 * @param {string} opts.subscriptionName       Le name renvoyé par Shopify (ex: "Pro")
 * @param {string} opts.status                 Statut reçu (ACTIVE, PENDING, etc.)
 * @returns {Promise<{matched: boolean, rowId?: string}>}
 */
async function matchPendingSubscriptionToWebhook({
  prisma,
  shopifySubscriptionId,
  shopDomain,
  subscriptionName,
  status,
}) {
  if (!prisma || !shopifySubscriptionId || !shopDomain) {
    return { matched: false };
  }

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM shopify_subscriptions WHERE shopify_subscription_id = $1::text LIMIT 1`,
    String(shopifySubscriptionId),
  );
  if (existing && existing.length > 0) {
    return { matched: true, rowId: existing[0].id };
  }

  // Pas encore matché : seul le 1er webhook ACTIVE avec un name connu déclenche
  // la promotion. Les transitions ultérieures (CANCELLED, FROZEN, etc.) sur un
  // sub déjà connu ne devraient jamais passer ici (existing aurait matché).
  if (status !== 'ACTIVE' || !subscriptionName) {
    return { matched: false };
  }

  const planKey = String(subscriptionName).trim().toUpperCase();
  if (!planKey) {
    return { matched: false };
  }

  const pendingRows = await prisma.$queryRawUnsafe(
    `
      SELECT id
      FROM shopify_subscriptions
      WHERE shop_domain = $1::text
        AND status = 'PENDING'
        AND plan_key = $2::text
      ORDER BY createdat DESC
      LIMIT 1
    `,
    shopDomain,
    planKey,
  );
  if (!pendingRows || pendingRows.length === 0) {
    return { matched: false };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE shopify_subscriptions SET shopify_subscription_id = $2::text, updatedat = NOW() WHERE id = $1::text`,
    pendingRows[0].id,
    String(shopifySubscriptionId),
  );

  return { matched: true, rowId: pendingRows[0].id };
}

module.exports = {
  handleAppUninstalled,
  matchPendingSubscriptionToWebhook,
};
