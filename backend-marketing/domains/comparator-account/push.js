'use strict';

/**
 * domains/comparator-account/push.js — Push du comparateur (Web Push + natif FCM).
 *
 * Deux familles d'abonnements dans "ComparatorPushSubscription" :
 * - web : (endpoint, p256dh, auth) — envoyés via web-push (VAPID) ;
 * - natif : (token, platform 'ios'|'android') — envoyés via FCM HTTP v1
 *   (google-auth-library, credentials FCM_SERVICE_ACCOUNT_JSON).
 *
 * Sans clés VAPID configurées, l'envoi web est un no-op explicite ({ skipped }) ;
 * sans FCM_PROJECT_ID, idem côté natif — on ne casse jamais l'appelant (le cron
 * d'alertes doit pouvoir tourner avec l'email seul).
 *
 * Les endpoints morts (404/410 web, UNREGISTERED FCM) sont purgés au fil de l'eau.
 * Senders injectables pour les tests.
 */

const crypto = require('crypto');

let webPush = null;
function getWebPush() {
  if (webPush) return webPush;
  // Chargement paresseux : la dépendance n'est requise que si le web push sert.
  // eslint-disable-next-line global-require
  webPush = require('web-push');
  return webPush;
}

function getVapidConfig() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:contact@feedplug.com').trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** Valide la shape d'un abonnement Web Push. PUR. */
function isValidSubscription(sub) {
  return Boolean(
    sub && typeof sub === 'object'
    && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 2048
    && sub.keys && typeof sub.keys === 'object'
    && typeof sub.keys.p256dh === 'string' && sub.keys.p256dh.length > 0 && sub.keys.p256dh.length < 512
    && typeof sub.keys.auth === 'string' && sub.keys.auth.length > 0 && sub.keys.auth.length < 512,
  );
}

/** Valide un token push natif { platform, token }. PUR. */
function isValidNativeToken(native) {
  return Boolean(
    native && typeof native === 'object'
    && (native.platform === 'ios' || native.platform === 'android')
    && typeof native.token === 'string' && native.token.trim().length > 0 && native.token.length < 4096,
  );
}

/** Upsert d'un abonnement web par endpoint (ré-abonnement = ré-attribution au user). */
async function saveSubscription(prisma, userId, sub, userAgent) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ComparatorPushSubscription" (id, userid, endpoint, p256dh, auth, platform, useragent, createdat)
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, 'web', $6::text, now())
    ON CONFLICT (endpoint) DO UPDATE
      SET userid = EXCLUDED.userid, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
          useragent = EXCLUDED.useragent, failurecount = 0
  `, crypto.randomUUID(), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth,
     typeof userAgent === 'string' ? userAgent.slice(0, 512) : null);
}

/** Upsert d'un token natif (ON CONFLICT token — index unique partiel 062). */
async function saveNativeToken(prisma, userId, native) {
  // ON CONFLICT sur index partiel : cible l'index par sa condition.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ComparatorPushSubscription" (id, userid, token, platform, createdat)
    VALUES ($1::text, $2::text, $3::text, $4::text, now())
    ON CONFLICT (token) WHERE token IS NOT NULL DO UPDATE
      SET userid = EXCLUDED.userid, platform = EXCLUDED.platform, failurecount = 0
  `, crypto.randomUUID(), userId, native.token.trim(), native.platform);
}

async function removeSubscription(prisma, userId, endpoint) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ComparatorPushSubscription" WHERE userid = $1::text AND endpoint = $2::text`,
    userId, endpoint,
  );
}

async function removeNativeToken(prisma, userId, token) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ComparatorPushSubscription" WHERE userid = $1::text AND token = $2::text`,
    userId, token,
  );
}

/** Sender Web Push par défaut. Jette sur échec ; statusCode consulté pour la purge. */
async function defaultWebSender(subscription, payload) {
  const vapid = getVapidConfig();
  if (!vapid) return { skipped: true, reason: 'VAPID non configuré' };
  const wp = getWebPush();
  wp.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  await wp.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600 });
  return { sent: true };
}

/**
 * Sender natif par défaut : FCM HTTP v1 via google-auth-library (déjà en dépendance,
 * credentials JSON du service account dans FCM_SERVICE_ACCOUNT_JSON).
 */
async function defaultNativeSender(token, payload) {
  const projectId = (process.env.FCM_PROJECT_ID || '').trim();
  const rawCreds = (process.env.FCM_SERVICE_ACCOUNT_JSON || '').trim();
  if (!projectId || !rawCreds) return { skipped: true, reason: 'FCM non configuré' };
  // eslint-disable-next-line global-require
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    credentials: JSON.parse(rawCreds),
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await client.request({
    url,
    method: 'POST',
    data: {
      message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ? Object.fromEntries(
          Object.entries(payload.data).map(([k, v]) => [k, String(v)]),
        ) : undefined,
      },
    },
  });
  return { sent: true, status: res.status };
}

function isGoneWebError(err) {
  const status = err && (err.statusCode || err.status);
  return status === 404 || status === 410;
}

function isGoneNativeError(err) {
  const status = err && (err.response?.status || err.status || err.code);
  const detail = JSON.stringify(err?.response?.data || '');
  return status === 404 || detail.includes('UNREGISTERED') || detail.includes('INVALID_ARGUMENT');
}

/**
 * Envoie une notification à TOUS les appareils d'un user (web + natif).
 * Ne jette jamais : retourne { sent, skipped, purged, failed }.
 * @param {object} payload { title, body, url?, data? }
 * @param {object} [opts] { webSender, nativeSender } injectables pour les tests
 */
async function sendToUser(prisma, userId, payload, opts = {}) {
  const webSender = opts.webSender || defaultWebSender;
  const nativeSender = opts.nativeSender || defaultNativeSender;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, endpoint, p256dh, auth, token, platform FROM "ComparatorPushSubscription" WHERE userid = $1::text`,
    userId,
  );
  const out = { sent: 0, skipped: 0, purged: 0, failed: 0 };
  for (const row of rows) {
    try {
      let result;
      if (row.token) {
        result = await nativeSender(row.token, payload);
      } else if (row.endpoint) {
        result = await webSender(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
        );
      } else {
        continue;
      }
      if (result && result.skipped) { out.skipped += 1; continue; }
      out.sent += 1;
      await prisma.$executeRawUnsafe(
        `UPDATE "ComparatorPushSubscription" SET lastnotifiedat = now(), failurecount = 0 WHERE id = $1::text`,
        row.id,
      ).catch(() => {});
    } catch (err) {
      const gone = row.token ? isGoneNativeError(err) : isGoneWebError(err);
      if (gone) {
        out.purged += 1;
        await prisma.$executeRawUnsafe(
          `DELETE FROM "ComparatorPushSubscription" WHERE id = $1::text`,
          row.id,
        ).catch(() => {});
      } else {
        out.failed += 1;
        await prisma.$executeRawUnsafe(
          `UPDATE "ComparatorPushSubscription" SET failurecount = failurecount + 1 WHERE id = $1::text`,
          row.id,
        ).catch(() => {});
      }
    }
  }
  return out;
}

module.exports = {
  getVapidConfig,
  isValidSubscription,
  isValidNativeToken,
  saveSubscription,
  saveNativeToken,
  removeSubscription,
  removeNativeToken,
  sendToUser,
  defaultWebSender,
  defaultNativeSender,
};
