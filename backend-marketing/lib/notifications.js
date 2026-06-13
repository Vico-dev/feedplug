/**
 * Centre de notifications in-app.
 *
 * createNotification est tolérant : il n'échoue jamais bruyamment (une
 * notification ratée ne doit pas casser le flux métier qui la déclenche).
 */
const crypto = require('crypto');

const VALID_TYPES = new Set(['success', 'error', 'warning', 'info', 'ab_test', 'performance']);
const VALID_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low']);

/**
 * Crée une notification pour un compte.
 * @returns {Promise<string|null>} l'id créé, ou null en cas d'échec.
 */
async function createNotification(prisma, accountId, { type, priority, title, message, actionUrl } = {}) {
  if (!prisma || !accountId || !title) return null;
  const id = crypto.randomUUID();
  const safeType = VALID_TYPES.has(type) ? type : 'info';
  const safePriority = VALID_PRIORITIES.has(priority) ? priority : 'medium';
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO notification (id, accountid, type, priority, title, message, actionurl, read, createdat)
       VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7, false, NOW())`,
      id,
      accountId,
      safeType,
      safePriority,
      String(title).slice(0, 300),
      String(message || '').slice(0, 2000),
      actionUrl ? String(actionUrl).slice(0, 500) : null
    );
    return id;
  } catch (e) {
    console.warn('createNotification error:', e?.message);
    return null;
  }
}

module.exports = { createNotification };
