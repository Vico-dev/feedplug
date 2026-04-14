const { PrismaClient } = require('@prisma/client');
const {
  decryptObjectSecrets,
  decryptSecret,
  encryptObjectSecrets,
  encryptSecret,
  isEncryptedSecret,
} = require('../lib/secret-crypto');

const prisma = new PrismaClient();

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value || '{}') || {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

function stringifyEncryptedJson(value) {
  return JSON.stringify(encryptObjectSecrets(decryptObjectSecrets(parseJsonObject(value))));
}

async function encryptCredentials() {
  const rows = await prisma.$queryRawUnsafe(`SELECT id, secretjson FROM "Credential"`);
  let updated = 0;
  for (const row of rows || []) {
    const encryptedJson = stringifyEncryptedJson(row.secretjson);
    await prisma.$executeRawUnsafe(
      `UPDATE "Credential" SET secretjson = $1::jsonb, updatedat = NOW() WHERE id = $2::text`,
      encryptedJson,
      row.id
    );
    updated++;
  }
  return updated;
}

async function encryptPlatformConnections() {
  const rows = await prisma.$queryRawUnsafe(`SELECT id, accesstoken, refreshtoken, metadata FROM "PlatformConnection"`);
  let updated = 0;
  for (const row of rows || []) {
    const accessToken = row.accesstoken ? encryptSecret(decryptSecret(row.accesstoken)) : null;
    const refreshToken = row.refreshtoken ? encryptSecret(decryptSecret(row.refreshtoken)) : null;
    const metadata = stringifyEncryptedJson(row.metadata);
    await prisma.$executeRawUnsafe(
      `UPDATE "PlatformConnection" SET accesstoken = $1::text, refreshtoken = $2::text, metadata = $3::jsonb, updatedat = NOW() WHERE id = $4::text`,
      accessToken,
      refreshToken,
      metadata,
      row.id
    );
    updated++;
  }
  return updated;
}

async function encryptMarketingAudits() {
  const rows = await prisma.$queryRawUnsafe(`SELECT id, inputjson FROM marketing_audits`);
  let updated = 0;
  for (const row of rows || []) {
    const inputJson = stringifyEncryptedJson(row.inputjson);
    await prisma.$executeRawUnsafe(
      `UPDATE marketing_audits SET inputjson = $1::jsonb, "updatedAt" = NOW() WHERE id = $2::text`,
      inputJson,
      row.id
    );
    updated++;
  }
  return updated;
}

async function main() {
  const keyConfigured = !!(process.env.FEEDPLUG_SECRET_ENCRYPTION_KEY || process.env.SECRET_ENCRYPTION_KEY || process.env.PLATFORM_SECRET_ENCRYPTION_KEY);
  if (!keyConfigured) {
    throw new Error('Set FEEDPLUG_SECRET_ENCRYPTION_KEY or SECRET_ENCRYPTION_KEY before running this migration');
  }

  const probe = encryptSecret('probe');
  if (!isEncryptedSecret(probe) || decryptSecret(probe) !== 'probe') {
    throw new Error('Secret encryption self-check failed');
  }

  const [credentials, platformConnections, marketingAudits] = await Promise.all([
    encryptCredentials(),
    encryptPlatformConnections(),
    encryptMarketingAudits(),
  ]);

  console.log(JSON.stringify({
    ok: true,
    updated: {
      credentials,
      platformConnections,
      marketingAudits,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('encrypt-existing-secrets failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
