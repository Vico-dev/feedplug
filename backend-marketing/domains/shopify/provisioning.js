/**
 * Auto-provisioning d'un Account FeedPlug à partir d'un install Shopify.
 *
 * Pour Built for Shopify : un merchant qui installe depuis l'App Store doit
 * pouvoir utiliser FeedPlug immédiatement, sans étape de signup séparée sur
 * feedplug.com. On crée donc Account + User + Credential + Source + Feed
 * automatiquement à la fin du flow OAuth.
 *
 * Gestion des collisions :
 *  - Email shop déjà associé à un User existant → on link l'Account existant
 *    UNIQUEMENT si ce User est `provider='shopify'` (sinon risque de fusion
 *    accidentelle de comptes appartenant à des entités différentes).
 *  - Si User local existe avec cet email → on ne provisionne pas et retourne
 *    `{ provisioned: false, reason: 'email_conflict' }`. Le merchant devra
 *    se logger sur FeedPlug et "claimer" la connexion.
 */

const crypto = require('crypto');
const { buildShopifyAdminGraphqlUrl } = require('./config');
const SHOPIFY_PROVIDER = 'shopify';
const DEFAULT_PLAN = 'STARTER';
const DEFAULT_TRIAL_DAYS = Number(process.env.SHOPIFY_PROVISION_TRIAL_DAYS || 14);

const SHOP_INFO_QUERY = `
  query shopProvisioning {
    shop {
      id
      name
      email
      myshopifyDomain
      contactEmail
      currencyCode
      primaryDomain { host }
      billingAddress {
        firstName
        lastName
        phone
        country
        countryCodeV2
        city
        zip
        address1
      }
    }
  }
`;

async function fetchShopInfo({ shop, accessToken, fetchImpl = fetch }) {
  const endpoint = buildShopifyAdminGraphqlUrl(shop);
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: SHOP_INFO_QUERY }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Shopify shop info HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`Shopify shop info errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data?.shop || null;
}

/**
 * Crée ou retrouve un Account associé à une boutique Shopify.
 *
 * @param {object} opts
 * @param {object} opts.prisma                 Prisma client
 * @param {string} opts.shop                   ex: "demo.myshopify.com"
 * @param {string} opts.accessToken            OAuth access_token (Shopify)
 * @param {string} [opts.credentialId]         Si fourni, link la Credential à
 *                                             la Source/Feed créés
 * @param {Function} [opts.fetchImpl]          Pour les tests
 * @returns {Promise<{ provisioned: boolean, accountId?: string, userId?: string,
 *                     existing?: boolean, reason?: string, email?: string }>}
 */
async function provisionAccountFromShopify({
  prisma,
  shop,
  accessToken,
  credentialId,
  fetchImpl,
}) {
  if (!prisma || !shop || !accessToken) {
    throw new Error('provisionAccountFromShopify: prisma/shop/accessToken requis');
  }

  // 1) Si la Credential est déjà liée à un Account, ne rien faire.
  if (credentialId) {
    const existingLink = await prisma.$queryRawUnsafe(
      `
        SELECT s.accountid
        FROM "FeedSource" s
        WHERE s.credentialid = $1::text
        LIMIT 1
      `,
      credentialId
    );
    if (existingLink && existingLink.length > 0 && existingLink[0].accountid) {
      return {
        provisioned: false,
        existing: true,
        accountId: existingLink[0].accountid,
        reason: 'already_linked',
      };
    }
  }

  // 2) Récupère les infos de la boutique.
  const shopInfo = await fetchShopInfo({ shop, accessToken, fetchImpl });
  if (!shopInfo) {
    throw new Error('Shopify shop info vide');
  }
  const email = (shopInfo.email || shopInfo.contactEmail || '').toLowerCase().trim();
  const shopName = shopInfo.name || shop.replace(/\.myshopify\.com$/, '');

  // 3) Gestion email conflict.
  let hasEmailConflict = false;
  if (email) {
    const existingUsers = await prisma.$queryRawUnsafe(
      `SELECT id, accountid, provider FROM "User" WHERE email = $1::text LIMIT 1`,
      email
    );
    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.provider === SHOPIFY_PROVIDER) {
        // Merchant Shopify déjà provisionné par un install précédent : on
        // retourne son Account et on linkera la Credential dessus.
        if (credentialId) {
          await linkCredentialToAccount({
            prisma,
            accountId: existing.accountid,
            credentialId,
            shop,
            shopName,
          });
        }
        return {
          provisioned: false,
          existing: true,
          accountId: existing.accountid,
          userId: existing.id,
          email,
          reason: 'shopify_user_exists',
        };
      }
      // User local existant avec même email : on NE FUSIONNE PAS automatiquement
      // (un attaquant pourrait sinon prendre le contrôle d'un Account en installant
      // l'app sur sa dev store avec un email connu). On crée un Account Shopify
      // *orphelin* (sans User côté FeedPlug) : l'auth se fait via session token
      // App Bridge, donc pas besoin de User pour utiliser l'app embedded.
      // Le merchant pourra plus tard se logger sur feedplug.com et "claimer" la
      // connexion via /api/v1/connectors/shopify/claim pour merger.
      hasEmailConflict = true;
    }
  }

  // 4) Crée Account + (User si pas de conflit) + Source + Feed.
  const accountId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const trialEndsAt = new Date(Date.now() + DEFAULT_TRIAL_DAYS * 24 * 3600 * 1000).toISOString();
  const billingAddress = shopInfo.billingAddress || {};
  const firstName = (billingAddress.firstName || '').slice(0, 100);
  const lastName = (billingAddress.lastName || '').slice(0, 100);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "Account" (
        id, name, plan, email,
        trialendsat, billingstatus, billing_provider,
        createdat, updatedat
      )
      VALUES (
        $1::text, $2::text, $3::text, $4::text,
        $5::timestamptz, 'pending'::text, 'SHOPIFY'::text,
        $6::timestamptz, $6::timestamptz
      )
      ON CONFLICT (id) DO NOTHING
    `,
    accountId,
    shopName,
    DEFAULT_PLAN,
    email || null,
    trialEndsAt,
    now
  );

  if (email && !hasEmailConflict) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO "User" (
          id, email, firstname, lastname, role, accountid,
          provider, providerid, status, createdat, updatedat
        )
        VALUES (
          $1::text, $2::text, $3::text, $4::text, 'OWNER'::text, $5::text,
          'shopify'::text, $6::text, 'ACTIVE'::text, $7::timestamptz, $7::timestamptz
        )
        ON CONFLICT (email) DO NOTHING
      `,
      userId,
      email,
      firstName,
      lastName,
      shop,
      now
    );
  }

  if (credentialId) {
    await linkCredentialToAccount({
      prisma,
      accountId,
      credentialId,
      shop,
      shopName,
    });
  }

  return {
    provisioned: true,
    accountId,
    userId: email && !hasEmailConflict ? userId : null,
    email: email || null,
    reason: hasEmailConflict ? 'orphan_account_email_conflict' : undefined,
  };
}

/**
 * Crée FeedSource + Feed liés à la Credential + Account donnés.
 * Idempotent : si une FeedSource existe déjà pour cette Credential, ne duplique pas.
 */
async function linkCredentialToAccount({ prisma, accountId, credentialId, shop, shopName }) {
  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM "FeedSource" WHERE credentialid = $1::text LIMIT 1`,
    credentialId
  );
  if (existing && existing.length > 0) {
    return { sourceId: existing[0].id, created: false };
  }

  const sourceId = crypto.randomUUID();
  const feedId = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceName = `Shopify - ${shopName || shop}`;
  const configData = JSON.stringify({ shop });
  const mappingData = JSON.stringify({ id: 'id', title: 'title', link: 'handle' });

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "FeedSource"
        (id, name, connector, configjson, defaultfreq, status, credentialid, accountid, createdat, updatedat)
      VALUES
        ($1::text, $2::text, 'SHOPIFY'::text, $3::jsonb, 'DAILY'::text, 'ACTIVE'::text, $4::text, $5::text, $6::timestamptz, $6::timestamptz)
    `,
    sourceId,
    sourceName,
    configData,
    credentialId,
    accountId,
    now
  );

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "Feed"
        (id, name, sourceid, frequency, status, mappingjson, dedupstrategy, createdat, updatedat, accountid)
      VALUES
        ($1::text, $2::text, $3::text, 'DAILY'::text, 'ACTIVE'::text, $4::jsonb, 'guid_or_url'::text, $5::timestamptz, $5::timestamptz, $6::text)
    `,
    feedId,
    `Flux principal - ${sourceName}`,
    sourceId,
    mappingData,
    now,
    accountId
  );

  return { sourceId, feedId, created: true };
}

module.exports = {
  provisionAccountFromShopify,
  linkCredentialToAccount,
  fetchShopInfo,
  _internals: { SHOP_INFO_QUERY },
};
