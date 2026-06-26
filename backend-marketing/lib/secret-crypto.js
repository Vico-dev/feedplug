const crypto = require('crypto');

// Formats de payload :
//  - enc:v1: <iv(12) | tag(16) | ct>  — KDF historique : sha256(material).
//    Conservé en lecture seule pour les secrets déjà stockés en base.
//  - enc:v2: <iv(12) | tag(16) | ct>  — KDF : scrypt(material, salt fixe).
//    Toute nouvelle écriture utilise v2.
//
// Le salt scrypt est fixe par déploiement : la dérivation se fait une fois au
// premier usage puis est mise en cache. Cela laisse à scrypt sa résistance
// au bruteforce sur material faible (passphrase) sans payer le coût à chaque
// chiffrement.
const ENCRYPTED_PREFIX_V1 = 'enc:v1:';
const ENCRYPTED_PREFIX_V2 = 'enc:v2:';
const ENCRYPTED_PREFIX = ENCRYPTED_PREFIX_V2;

const SCRYPT_SALT = Buffer.from('feedplug.secret-crypto.v2', 'utf8');
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

let cachedKeyV1 = null;
let cachedKeyV2 = null;

function getKeyMaterial() {
  return process.env.FEEDPLUG_SECRET_ENCRYPTION_KEY ||
    process.env.SECRET_ENCRYPTION_KEY ||
    process.env.PLATFORM_SECRET_ENCRYPTION_KEY ||
    '';
}

function getKeyV1(material) {
  if (!cachedKeyV1 || cachedKeyV1.material !== material) {
    cachedKeyV1 = {
      material,
      key: crypto.createHash('sha256').update(material).digest(),
    };
  }
  return cachedKeyV1.key;
}

function getKeyV2(material) {
  if (!cachedKeyV2 || cachedKeyV2.material !== material) {
    cachedKeyV2 = {
      material,
      key: crypto.scryptSync(material, SCRYPT_SALT, 32, SCRYPT_PARAMS),
    };
  }
  return cachedKeyV2.key;
}

function isEncryptedSecret(value) {
  return typeof value === 'string' &&
    (value.startsWith(ENCRYPTED_PREFIX_V2) || value.startsWith(ENCRYPTED_PREFIX_V1));
}

function encryptSecret(value) {
  if (value == null || value === '') return value;
  if (isEncryptedSecret(value)) return value;
  const material = getKeyMaterial();
  if (!material) {
    throw new Error('SECRET_ENCRYPTION_KEY is required to encrypt secrets');
  }

  const key = getKeyV2(material);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = String(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX_V2}${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
}

function decryptSecret(value) {
  if (!isEncryptedSecret(value)) return value;
  const material = getKeyMaterial();
  if (!material) {
    throw new Error('SECRET_ENCRYPTION_KEY is required to decrypt stored secrets');
  }

  let key;
  let payloadStart;
  if (value.startsWith(ENCRYPTED_PREFIX_V2)) {
    key = getKeyV2(material);
    payloadStart = ENCRYPTED_PREFIX_V2.length;
  } else {
    key = getKeyV1(material);
    payloadStart = ENCRYPTED_PREFIX_V1.length;
  }

  const payload = Buffer.from(value.slice(payloadStart), 'base64url');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function isSecretKey(key) {
  return /token|secret|apikey|api_key|password|privatekey|private_key/i.test(String(key || ''));
}

function transformObjectSecrets(value, transform) {
  if (Array.isArray(value)) {
    return value.map((item) => transformObjectSecrets(item, transform));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (entry == null) return [key, entry];
    if (isSecretKey(key) && typeof entry === 'string') {
      return [key, transform(entry)];
    }
    return [key, transformObjectSecrets(entry, transform)];
  }));
}

function encryptObjectSecrets(value) {
  return transformObjectSecrets(value, encryptSecret);
}

function decryptObjectSecrets(value) {
  return transformObjectSecrets(value, decryptSecret);
}

function redactObjectSecrets(value) {
  return transformObjectSecrets(value, () => '[redacted]');
}

module.exports = {
  decryptObjectSecrets,
  decryptSecret,
  encryptObjectSecrets,
  encryptSecret,
  isEncryptedSecret,
  redactObjectSecrets,
};
