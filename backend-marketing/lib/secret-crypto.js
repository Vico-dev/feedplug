const crypto = require('crypto');

const ENCRYPTED_PREFIX = 'enc:v1:';
let cachedKey = null;

function getKeyMaterial() {
  return process.env.FEEDPLUG_SECRET_ENCRYPTION_KEY ||
    process.env.SECRET_ENCRYPTION_KEY ||
    process.env.PLATFORM_SECRET_ENCRYPTION_KEY ||
    '';
}

function getKey() {
  const material = getKeyMaterial();
  if (!material) return null;
  if (!cachedKey || cachedKey.material !== material) {
    cachedKey = {
      material,
      key: crypto.createHash('sha256').update(material).digest(),
    };
  }
  return cachedKey.key;
}

function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

function encryptSecret(value) {
  if (value == null || value === '') return value;
  if (isEncryptedSecret(value)) return value;
  const key = getKey();
  if (!key) {
    throw new Error('SECRET_ENCRYPTION_KEY is required to encrypt secrets');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = String(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64url')}`;
}

function decryptSecret(value) {
  if (!isEncryptedSecret(value)) return value;
  const key = getKey();
  if (!key) {
    throw new Error('SECRET_ENCRYPTION_KEY is required to decrypt stored secrets');
  }

  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64url');
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
