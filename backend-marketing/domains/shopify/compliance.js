/**
 * Shopify mandatory compliance webhooks (App Store requirement).
 *
 * Trois topics doivent être implémentés pour être listé sur le Shopify App Store :
 *  - customers/data_request : un merchant demande une copie des données client. SLA: 30 jours.
 *  - customers/redact       : effacer les données d'un customer spécifique. SLA: 30 jours après uninstall.
 *  - shop/redact            : effacer toutes les données du shop. SLA: 48h après réception.
 *
 * FeedPlug n'ingère pas de données client Shopify (uniquement produits via GraphQL).
 * Les deux webhooks `customers/*` n'ont donc rien à effacer côté DB ; on persiste la requête
 * pour audit et on alerte par email pour conformité documentée.
 *
 * Pour `shop/redact`, on supprime cascade : FeedItem → Feed → FeedSource → Credential
 * pour toutes les boutiques Shopify matchant `shopDomain`.
 */

const crypto = require('crypto');

const COMPLIANCE_TOPICS = Object.freeze({
  CUSTOMERS_DATA_REQUEST: 'customers/data_request',
  CUSTOMERS_REDACT: 'customers/redact',
  SHOP_REDACT: 'shop/redact',
});

function isComplianceTopic(topic) {
  return Object.values(COMPLIANCE_TOPICS).includes(topic);
}

async function recordComplianceRequest({ prisma, topic, shopDomain, payload }) {
  const id = crypto.randomUUID();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO shopify_compliance_requests
        (id, topic, shop_domain, payload, status, createdat, updatedat)
      VALUES ($1::text, $2::text, $3::text, $4::jsonb, 'received'::text, NOW(), NOW())
    `,
    id,
    topic,
    shopDomain || '',
    JSON.stringify(safePayload)
  );
  return id;
}

async function markRequestProcessed({ prisma, requestId, errorMessage = null }) {
  const status = errorMessage ? 'error' : 'processed';
  await prisma.$executeRawUnsafe(
    `
      UPDATE shopify_compliance_requests
      SET status = $2::text,
          processed_at = NOW(),
          error_message = $3,
          updatedat = NOW()
      WHERE id = $1::text
    `,
    requestId,
    status,
    errorMessage
  );
}

/**
 * customers/data_request — FeedPlug ne stocke pas de données customer Shopify.
 * On acknowledge et on notifie pour documenter le traitement.
 */
async function handleCustomersDataRequest({ prisma, shopDomain, payload, notifyAdmin }) {
  if (typeof notifyAdmin === 'function') {
    await notifyAdmin({
      subject: `[Shopify GDPR] customers/data_request — ${shopDomain}`,
      body:
        `Une demande customers/data_request a été reçue pour ${shopDomain}.\n\n` +
        `FeedPlug n'ingère pas de données client Shopify (uniquement produits).\n` +
        `Aucune donnée client à fournir.\n\n` +
        `SLA Shopify : répondre au merchant sous 30 jours.\n\n` +
        `Payload :\n${JSON.stringify(payload || {}, null, 2)}`,
    }).catch((err) => {
      console.warn('Shopify compliance admin notify failed (data_request):', err?.message || err);
    });
  }
}

/**
 * customers/redact — FeedPlug ne stocke pas de données customer Shopify.
 * Rien à effacer ; on log pour traçabilité.
 */
async function handleCustomersRedact({ prisma, shopDomain, payload, notifyAdmin }) {
  if (typeof notifyAdmin === 'function') {
    await notifyAdmin({
      subject: `[Shopify GDPR] customers/redact — ${shopDomain}`,
      body:
        `Une demande customers/redact a été reçue pour ${shopDomain}.\n\n` +
        `FeedPlug n'ingère pas de données client Shopify, aucune suppression nécessaire.\n\n` +
        `Payload :\n${JSON.stringify(payload || {}, null, 2)}`,
    }).catch((err) => {
      console.warn('Shopify compliance admin notify failed (customers_redact):', err?.message || err);
    });
  }
}

/**
 * shop/redact — supprime toutes les données liées à la boutique.
 * Reçu 48h après uninstall, donc 48h de grâce pour erreurs d'uninstall accidentelles.
 * SLA : effacer sous 48h après réception.
 */
async function handleShopRedact({ prisma, shopDomain, payload, notifyAdmin, appId }) {
  if (!shopDomain) {
    throw new Error('shop/redact: shopDomain manquant');
  }

  // Trouver les credentials Shopify liés à cette boutique. Si appId est fourni,
  // on NE supprime QUE les données de l'app concernée (une boutique peut avoir
  // les deux apps : un shop/redact reçu pour le connecteur ne doit pas effacer
  // les données de l'app listée encore active). Credentials legacy sans appId
  // = 'listed'. Sans appId (rétro-compat / tests) : scope sur le shop seul.
  const credentials = appId
    ? await prisma.$queryRawUnsafe(
        `
          SELECT id
          FROM "Credential"
          WHERE connector = 'SHOPIFY'::text
            AND secretjson->>'shop' = $1::text
            AND COALESCE(secretjson->>'appId', 'listed') = $2::text
        `,
        shopDomain,
        appId
      )
    : await prisma.$queryRawUnsafe(
        `
          SELECT id
          FROM "Credential"
          WHERE connector = 'SHOPIFY'::text
            AND secretjson->>'shop' = $1::text
        `,
        shopDomain
      );

  if (!credentials || credentials.length === 0) {
    return { credentialsRemoved: 0, sourcesRemoved: 0, feedsRemoved: 0, itemsRemoved: 0 };
  }

  const credentialIds = credentials.map((r) => r.id);

  // Récupérer les sources liées.
  const sources = await prisma.$queryRawUnsafe(
    `
      SELECT id
      FROM "FeedSource"
      WHERE connector = 'SHOPIFY'::text
        AND credentialid = ANY($1::text[])
    `,
    credentialIds
  );
  const sourceIds = (sources || []).map((r) => r.id);

  // Récupérer les feeds liés.
  let feedIds = [];
  if (sourceIds.length > 0) {
    const feeds = await prisma.$queryRawUnsafe(
      `
        SELECT id
        FROM "Feed"
        WHERE sourceid = ANY($1::text[])
      `,
      sourceIds
    );
    feedIds = (feeds || []).map((r) => r.id);
  }

  let itemsRemoved = 0;
  let feedsRemoved = 0;
  let sourcesRemoved = 0;
  let credentialsRemoved = 0;

  // Supprimer en cascade (du plus dépendant au moins dépendant).
  if (feedIds.length > 0) {
    const items = await prisma.$executeRawUnsafe(
      `DELETE FROM "FeedItem" WHERE feedid = ANY($1::text[])`,
      feedIds
    );
    itemsRemoved = Number(items) || 0;

    // Tables enfant supplémentaires sur Feed (best-effort, on ignore si absentes).
    for (const child of ['EnrichmentSource', 'IngestionRun']) {
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "${child}" WHERE feedid = ANY($1::text[])`,
          feedIds
        );
      } catch (err) {
        console.warn(`shop/redact: skip ${child} cleanup (${err?.message || err})`);
      }
    }

    const feeds = await prisma.$executeRawUnsafe(
      `DELETE FROM "Feed" WHERE id = ANY($1::text[])`,
      feedIds
    );
    feedsRemoved = Number(feeds) || 0;
  }

  if (sourceIds.length > 0) {
    const sourcesDel = await prisma.$executeRawUnsafe(
      `DELETE FROM "FeedSource" WHERE id = ANY($1::text[])`,
      sourceIds
    );
    sourcesRemoved = Number(sourcesDel) || 0;
  }

  const credsDel = await prisma.$executeRawUnsafe(
    `DELETE FROM "Credential" WHERE id = ANY($1::text[])`,
    credentialIds
  );
  credentialsRemoved = Number(credsDel) || 0;

  const summary = { credentialsRemoved, sourcesRemoved, feedsRemoved, itemsRemoved };

  if (typeof notifyAdmin === 'function') {
    await notifyAdmin({
      subject: `[Shopify GDPR] shop/redact — ${shopDomain}`,
      body:
        `Toutes les données liées à ${shopDomain} ont été supprimées.\n\n` +
        `Résumé :\n${JSON.stringify(summary, null, 2)}\n\n` +
        `Payload Shopify :\n${JSON.stringify(payload || {}, null, 2)}`,
    }).catch((err) => {
      console.warn('Shopify compliance admin notify failed (shop_redact):', err?.message || err);
    });
  }

  return summary;
}

async function processComplianceWebhook({ prisma, topic, shopDomain, payload, notifyAdmin, appId }) {
  const requestId = await recordComplianceRequest({ prisma, topic, shopDomain, payload });

  try {
    if (topic === COMPLIANCE_TOPICS.CUSTOMERS_DATA_REQUEST) {
      await handleCustomersDataRequest({ prisma, shopDomain, payload, notifyAdmin });
    } else if (topic === COMPLIANCE_TOPICS.CUSTOMERS_REDACT) {
      await handleCustomersRedact({ prisma, shopDomain, payload, notifyAdmin });
    } else if (topic === COMPLIANCE_TOPICS.SHOP_REDACT) {
      await handleShopRedact({ prisma, shopDomain, payload, notifyAdmin, appId });
    } else {
      throw new Error(`Topic compliance inconnu: ${topic}`);
    }
    await markRequestProcessed({ prisma, requestId });
    return { requestId, status: 'processed' };
  } catch (err) {
    const message = err?.message || String(err);
    await markRequestProcessed({ prisma, requestId, errorMessage: message }).catch(() => {});
    throw err;
  }
}

module.exports = {
  COMPLIANCE_TOPICS,
  isComplianceTopic,
  processComplianceWebhook,
  handleShopRedact,
  handleCustomersDataRequest,
  handleCustomersRedact,
  recordComplianceRequest,
  markRequestProcessed,
};
