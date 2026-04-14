const { PrismaClient } = require('@prisma/client');
const { decryptSecret, decryptObjectSecrets } = require('../lib/secret-crypto');

const prisma = new PrismaClient();

function trim(value) {
  return typeof value === 'string' ? value.slice(0, 240) : value;
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function testShopify() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, connector, secretjson, updatedat
     FROM "Credential"
     WHERE connector = 'SHOPIFY'
     ORDER BY updatedat DESC
     LIMIT 3`
  );

  const results = [];
  for (const row of rows) {
    const secret = decryptObjectSecrets(parseJson(row.secretjson));
    const rawShop = String(secret.shop || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    const shop = rawShop
      ? (rawShop.endsWith('.myshopify.com') ? rawShop : `${rawShop}.myshopify.com`)
      : '';
    const accessToken = secret.accessToken || secret.access_token || secret.token || null;
    const out = { credentialId: row.id, name: row.name, shop, ok: false };

    if (!shop || !accessToken) {
      out.error = 'missing_shop_or_token';
      results.push(out);
      continue;
    }

    try {
      const res = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });
      out.httpStatus = res.status;
      if (res.ok) {
        const data = await res.json();
        out.ok = true;
        out.shopName = data?.shop?.name || null;
        out.domain = data?.shop?.domain || null;
      } else {
        out.error = trim(await res.text());
      }
    } catch (error) {
      out.error = trim(error.message);
    }

    results.push(out);
  }

  return { found: rows.length, results };
}

async function refreshGoogleAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`google_refresh_failed:${res.status}:${trim(await res.text())}`);
  }

  return (await res.json()).access_token;
}

async function testGmc() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT accountid, merchantid, email, refreshtoken
     FROM "PlatformConnection"
     WHERE platform = 'gmc' AND status = 'active'
     ORDER BY updatedat DESC
     LIMIT 3`
  );

  const results = [];
  for (const row of rows) {
    const out = {
      accountId: row.accountid,
      merchantId: row.merchantid,
      email: row.email,
      ok: false,
    };

    try {
      const refreshToken = decryptSecret(row.refreshtoken);
      const accessToken = await refreshGoogleAccessToken(refreshToken);
      const authRes = await fetch(
        'https://shoppingcontent.googleapis.com/content/v2.1/accounts/authinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      out.httpStatus = authRes.status;
      if (authRes.ok) {
        const data = await authRes.json();
        const ids = Array.isArray(data?.accountIdentifiers) ? data.accountIdentifiers : [];
        out.ok = true;
        out.accountIdentifiers = ids.length;
        out.merchantMatched = !!row.merchantid && ids.some(
          (entry) => String(entry.merchantId || entry.aggregatorId || '') === String(row.merchantid || '')
        );
      } else {
        out.error = trim(await authRes.text());
      }
    } catch (error) {
      out.error = trim(error.message);
    }

    results.push(out);
  }

  return { found: rows.length, results };
}

async function testAmazonAds() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT accountid, merchantid, metadata, refreshtoken
     FROM "PlatformConnection"
     WHERE platform = 'amazon_ads' AND status = 'active'
     ORDER BY updatedat DESC
     LIMIT 3`
  );

  const results = [];
  for (const row of rows) {
    const meta = decryptObjectSecrets(parseJson(row.metadata));
    const clientId = meta.clientId || meta.client_id || null;
    const clientSecret = meta.clientSecret || meta.client_secret || null;
    const refreshToken = row.refreshtoken ? decryptSecret(row.refreshtoken) : null;
    const region = String(meta.region || 'eu').toLowerCase() === 'na' ? 'na' : 'eu';
    const apiBase = region === 'na'
      ? 'https://advertising-api.amazon.com'
      : 'https://advertising-api-eu.amazon.com';
    const out = {
      accountId: row.accountid,
      profileId: row.merchantid,
      region,
      ok: false,
    };

    if (!clientId || !clientSecret || !refreshToken) {
      out.error = 'missing_client_or_token';
      results.push(out);
      continue;
    }

    try {
      const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      out.tokenStatus = tokenRes.status;
      if (!tokenRes.ok) {
        throw new Error(`amazon_refresh_failed:${tokenRes.status}:${trim(await tokenRes.text())}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const profilesRes = await fetch(`${apiBase}/v2/profiles`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Amazon-Advertising-API-ClientId': clientId,
        },
      });

      out.httpStatus = profilesRes.status;
      if (profilesRes.ok) {
        const profiles = await profilesRes.json();
        out.ok = true;
        out.profileCount = Array.isArray(profiles) ? profiles.length : 0;
        out.profileMatched = Array.isArray(profiles)
          ? profiles.some((profile) => String(profile.profileId || profile.profile_id || '') === String(row.merchantid || ''))
          : false;
      } else {
        out.error = trim(await profilesRes.text());
      }
    } catch (error) {
      out.error = trim(error.message);
    }

    results.push(out);
  }

  return { found: rows.length, results };
}

async function main() {
  const result = {
    ok: true,
    shopify: await testShopify(),
    gmc: await testGmc(),
    amazonAds: await testAmazonAds(),
  };
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(async (error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
