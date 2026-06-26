const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.SECRET_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';

const {
  encryptSecret,
  decryptSecret,
  encryptObjectSecrets,
  decryptObjectSecrets,
  redactObjectSecrets,
  isEncryptedSecret,
} = require('../../lib/secret-crypto');

describe('Secret Crypto', () => {
  describe('encryptSecret / decryptSecret', () => {
    it('should encrypt and decrypt a secret', () => {
      const original = 'my-super-secret-token';
      const encrypted = encryptSecret(original);
      const decrypted = decryptSecret(encrypted);

      assert.notStrictEqual(encrypted, original, 'encrypted should differ from original');
      assert.strictEqual(decrypted, original, 'decrypted should equal original');
    });

    it('should not double-encrypt already encrypted values', () => {
      const original = 'my-secret';
      const encrypted = encryptSecret(original);
      const doubleEncrypted = encryptSecret(encrypted);

      assert.strictEqual(doubleEncrypted, encrypted, 'should not re-encrypt already encrypted');
      assert.strictEqual(decryptSecret(doubleEncrypted), original);
    });

    it('should return null/undefined unchanged', () => {
      assert.strictEqual(encryptSecret(null), null);
      assert.strictEqual(encryptSecret(undefined), undefined);
      assert.strictEqual(decryptSecret(null), null);
      assert.strictEqual(decryptSecret(undefined), undefined);
    });

    it('should detect encrypted secrets', () => {
      const encrypted = encryptSecret('secret');
      assert.strictEqual(isEncryptedSecret(encrypted), true);
      assert.strictEqual(isEncryptedSecret('plain-text'), false);
    });

    it('should produce different ciphertexts for same input (random IV)', () => {
      const original = 'test-secret';
      const encrypted1 = encryptSecret(original);
      const encrypted2 = encryptSecret(original);

      assert.notStrictEqual(encrypted1, encrypted2, 'each encryption should use different IV');
      assert.strictEqual(decryptSecret(encrypted1), original);
      assert.strictEqual(decryptSecret(encrypted2), original);
    });
  });

  describe('encryptObjectSecrets / decryptObjectSecrets', () => {
    it('should encrypt secrets in object', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        apiKey: 'key-123',
      };

      const encrypted = encryptObjectSecrets(obj);

      assert.strictEqual(encrypted.username, 'john');
      assert.notStrictEqual(encrypted.password, 'secret123');
      assert.notStrictEqual(encrypted.apiKey, 'key-123');
      assert.strictEqual(isEncryptedSecret(encrypted.password), true);
    });

    it('should decrypt secrets in object', () => {
      const original = {
        username: 'john',
        password: 'secret123',
      };

      const encrypted = encryptObjectSecrets(original);
      const decrypted = decryptObjectSecrets(encrypted);

      assert.strictEqual(decrypted.username, 'john');
      assert.strictEqual(decrypted.password, 'secret123');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          token: 'nested-token',
        },
      };

      const encrypted = encryptObjectSecrets(obj);
      const decrypted = decryptObjectSecrets(encrypted);

      assert.strictEqual(decrypted.user.token, 'nested-token');
    });

    it('should handle arrays', () => {
      const arr = [
        { name: 'item1', secret: 'secret1' },
        { name: 'item2', secret: 'secret2' },
      ];

      const encrypted = encryptObjectSecrets(arr);
      const decrypted = decryptObjectSecrets(encrypted);

      assert.strictEqual(decrypted[0].secret, 'secret1');
      assert.strictEqual(decrypted[1].secret, 'secret2');
    });
  });

  describe('versioned KDF', () => {
    it('should write new secrets in v2 (scrypt) format', () => {
      const encrypted = encryptSecret('hello');
      assert.ok(encrypted.startsWith('enc:v2:'), `expected enc:v2: prefix, got ${encrypted.slice(0, 12)}`);
    });

    it('should still decrypt legacy v1 (sha256) payloads', () => {
      // Reproduit le chiffrement v1 historique (sha256 KDF) pour vérifier la
      // rétrocompat sur les secrets déjà stockés en base.
      const key = crypto.createHash('sha256').update(process.env.SECRET_ENCRYPTION_KEY).digest();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([cipher.update('legacy-value', 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const v1 = 'enc:v1:' + Buffer.concat([iv, tag, ct]).toString('base64url');

      assert.strictEqual(isEncryptedSecret(v1), true);
      assert.strictEqual(decryptSecret(v1), 'legacy-value');
    });
  });

  describe('redactObjectSecrets', () => {
    it('should redact secret values', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
      };

      const redacted = redactObjectSecrets(obj);

      assert.strictEqual(redacted.username, 'john');
      assert.strictEqual(redacted.password, '[redacted]');
    });
  });
});
