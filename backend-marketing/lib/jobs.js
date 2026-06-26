'use strict';

/**
 * lib/jobs.js — Abstraction de file de jobs longs (Sprint 2, B-PROPER).
 *
 * Problème résolu : les schedulers `setTimeout`+`Map`+`.unref()` au niveau
 * module (scheduleAutoGmcPush / scheduleAutoOptimization / scheduleAutoLiaSync)
 * et l'ingestion synchrone bloquent le thread HTTP et sont perdus au
 * scale-to-zero de Cloud Run (les timers `.unref()` ne survivent pas a l'arret
 * de l'instance, et la deduplication par `Map` est locale a une instance).
 *
 * Ce module fournit `enqueueJob(type, payload, opts)` au-dessus de Google
 * Cloud Tasks. Deux modes, choisis a l'execution selon l'environnement :
 *
 *   1. Mode "cloud-tasks" (PROD cible) — si `CLOUD_TASKS_QUEUE` est configure ET
 *      le SDK `@google-cloud/tasks` est installe. Cree une Cloud Task HTTP vers
 *      l'endpoint worker interne (`/internal/jobs/run`). Le NOM de tache est
 *      deterministe (derive de dedupKey + fenetre temporelle) : Cloud Tasks
 *      refuse deux taches de meme nom dans une fenetre de ~1h apres execution,
 *      ce qui donne un debounce/dedup DISTRIBUE natif (remplace la `Map`
 *      par-instance). Le delai est porte par `scheduleTime`.
 *
 *   2. Mode "in-process" (DEV / deploiement progressif) — fallback `setTimeout`
 *      qui reproduit le comportement actuel (debounce par `dedupKey` via une
 *      `Map` locale). Permet de tourner sans provisionner Cloud Tasks et de
 *      deployer Sprint 2 sans rien casser. NON resistant au scale-to-zero —
 *      c'est pourquoi `--min-instances 1` doit rester tant que ce mode est le
 *      chemin par defaut en prod (cf. cloudbuild + rapport).
 *
 * Le mode effectif est logge une fois au premier enqueue.
 */

const crypto = require('crypto');

// --- Configuration (lue paresseusement pour rester testable) ---------------

function readConfig() {
  return {
    // ex: "projects/feedplug/locations/europe-west1/queues/feedplug-jobs"
    queue: (process.env.CLOUD_TASKS_QUEUE || '').trim(),
    // URL publique du service backend (Cloud Run), pour l'endpoint worker HTTP.
    // ex: "https://backend-marketing-xxxx.run.app"
    workerBaseUrl: (process.env.CLOUD_TASKS_WORKER_BASE_URL || process.env.PUBLIC_BACKEND_URL || '').trim(),
    // Secret partage envoye en header au worker (reutilise SCHEDULER_SECRET).
    workerSecret: (process.env.SCHEDULER_SECRET || '').trim(),
    // Compte de service pour signer un token OIDC (auth Cloud Run IAM). Optionnel :
    // si absent, on retombe sur l'auth par secret partage (header).
    oidcServiceAccountEmail: (process.env.CLOUD_TASKS_OIDC_SA_EMAIL || '').trim(),
    // Fenetre de debounce/dedup par defaut (ms) pour le nommage deterministe.
    defaultDedupWindowMs: Number(process.env.JOBS_DEDUP_WINDOW_MS || 30000),
  };
}

// SDK charge paresseusement : son absence ne doit pas casser le require() du
// module (le fallback in-process doit marcher sans la dependance installee).
let _tasksClient = null;
let _tasksClientResolved = false;
function getTasksClient() {
  if (_tasksClientResolved) return _tasksClient;
  _tasksClientResolved = true;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const { CloudTasksClient } = require('@google-cloud/tasks');
    _tasksClient = new CloudTasksClient();
  } catch (_err) {
    _tasksClient = null; // SDK non installe -> mode in-process force.
  }
  return _tasksClient;
}

/**
 * Determine le mode effectif. Cloud Tasks n'est utilise que si la queue, l'URL
 * worker ET le SDK sont disponibles. Sinon fallback in-process.
 */
function resolveMode(cfg) {
  cfg = cfg || readConfig();
  if (cfg.queue && cfg.workerBaseUrl && getTasksClient()) return 'cloud-tasks';
  return 'in-process';
}

let _loggedMode = null;
function logModeOnce(mode, cfg) {
  if (_loggedMode === mode) return;
  _loggedMode = mode;
  if (mode === 'cloud-tasks') {
    console.log('[jobs] mode=cloud-tasks queue=' + cfg.queue + ' worker=' + cfg.workerBaseUrl + '/internal/jobs/run');
  } else {
    const why = !cfg.queue
      ? 'CLOUD_TASKS_QUEUE absent'
      : !cfg.workerBaseUrl
        ? 'CLOUD_TASKS_WORKER_BASE_URL absent'
        : '@google-cloud/tasks non installe';
    console.log('[jobs] mode=in-process (fallback setTimeout) — raison: ' + why + '. Jobs perdus au scale-to-zero ; garder --min-instances 1.');
  }
}

// --- Nommage deterministe (coeur du debounce/dedup distribue) ----------------

/**
 * Fenetre temporelle : on tronque l'instant courant (+ delai) a un multiple de
 * `windowMs`. Deux enqueues du meme `dedupKey` dans la meme fenetre produisent
 * le MEME nom de tache -> Cloud Tasks en garde une seule (debounce distribue).
 * Expose pour les tests.
 */
function computeWindowBucket(nowMs, windowMs) {
  const w = Math.max(1, Number(windowMs) || 1);
  return Math.floor(nowMs / w);
}

/**
 * Identifiant de tache deterministe et sur pour Cloud Tasks (regex
 * `[A-Za-z0-9_-]{1,500}`). On hashe `type:dedupKey:bucket` pour rester court et
 * eviter les caracteres interdits. Sans dedupKey, on genere un nom unique.
 * Expose pour les tests.
 */
function computeTaskName(args) {
  const type = args.type;
  const dedupKey = args.dedupKey;
  const scheduleDelayMs = args.scheduleDelayMs || 0;
  const dedupWindowMs = args.dedupWindowMs;
  const nowMs = args.nowMs != null ? args.nowMs : Date.now();
  if (!dedupKey) {
    // Pas de dedup demandee : nom unique -> chaque enqueue cree sa tache.
    return 'job-' + type + '-' + crypto.randomUUID();
  }
  const windowMs = Math.max(1, Number(dedupWindowMs) || 1);
  const bucket = computeWindowBucket(nowMs + Math.max(0, scheduleDelayMs), windowMs);
  const digest = crypto
    .createHash('sha256')
    .update(type + '::' + dedupKey + '::' + bucket)
    .digest('hex')
    .slice(0, 40);
  // Prefixe lisible (tronque) + hash : facilite le debug dans la console Cloud Tasks.
  const safePrefix = String(type + '-' + dedupKey)
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 80);
  return safePrefix + '-' + digest;
}

// --- Fallback in-process ----------------------------------------------------

const _inProcessTimers = new Map();

/**
 * Reproduit le comportement `setTimeout`+`Map`+`.unref()` historique. Le
 * dispatch est injecte (reference au worker local) pour eviter une dependance
 * circulaire avec server-minimal.js.
 */
function enqueueInProcess(type, payload, opts, dispatch) {
  const dedupKey = opts && opts.dedupKey;
  const scheduleDelayMs = (opts && opts.scheduleDelayMs) || 0;
  const key = dedupKey ? type + ':' + dedupKey : type + ':' + crypto.randomUUID();
  const existing = _inProcessTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    _inProcessTimers.delete(key);
    try {
      await dispatch(type, payload);
    } catch (err) {
      console.warn('[jobs] in-process dispatch ' + type + ' echoue:', (err && err.message) || err);
    }
  }, Math.max(0, scheduleDelayMs));
  if (typeof timer.unref === 'function') timer.unref();
  _inProcessTimers.set(key, timer);
  return { mode: 'in-process', key };
}

// --- Cloud Tasks ------------------------------------------------------------

async function enqueueCloudTask(type, payload, opts, cfg) {
  const client = getTasksClient();
  const url = cfg.workerBaseUrl.replace(/\/+$/, '') + '/internal/jobs/run';
  const taskName = computeTaskName({
    type: type,
    dedupKey: opts.dedupKey,
    scheduleDelayMs: opts.scheduleDelayMs || 0,
    dedupWindowMs: opts.dedupWindowMs,
  });

  const httpRequest = {
    httpMethod: 'POST',
    url: url,
    headers: { 'Content-Type': 'application/json' },
    body: Buffer.from(JSON.stringify({ type: type, payload: payload })).toString('base64'),
  };
  // Auth : OIDC (prefere, IAM Cloud Run) si SA configure, sinon secret partage.
  if (cfg.oidcServiceAccountEmail) {
    httpRequest.oidcToken = {
      serviceAccountEmail: cfg.oidcServiceAccountEmail,
      audience: cfg.workerBaseUrl.replace(/\/+$/, ''),
    };
  } else if (cfg.workerSecret) {
    httpRequest.headers['X-Scheduler-Secret'] = cfg.workerSecret;
  }

  const task = {
    name: cfg.queue + '/tasks/' + taskName,
    httpRequest: httpRequest,
  };
  const scheduleDelayMs = opts.scheduleDelayMs || 0;
  if (scheduleDelayMs > 0) {
    task.scheduleTime = { seconds: Math.floor((Date.now() + scheduleDelayMs) / 1000) };
  }

  try {
    await client.createTask({ parent: cfg.queue, task: task });
    return { mode: 'cloud-tasks', taskName: taskName };
  } catch (err) {
    // ALREADY_EXISTS (code 6) = une tache de meme nom est deja en file/executee
    // dans la fenetre -> c'est precisement la dedup attendue, pas une erreur.
    if ((err && err.code === 6) || /ALREADY_EXISTS/i.test((err && err.message) || '')) {
      return { mode: 'cloud-tasks', taskName: taskName, deduped: true };
    }
    throw err;
  }
}

// --- API publique -----------------------------------------------------------

/**
 * `dispatch` : fonction `(type, payload) => Promise` utilisee par le fallback
 * in-process pour executer le job localement (le worker HTTP l'utilise aussi).
 * Injectee via `configureJobs` pour eviter le couplage avec server-minimal.js.
 */
let _dispatch = async () => {
  throw new Error('[jobs] dispatch non configure — appeler configureJobs({ dispatch }) au boot.');
};

function configureJobs(args) {
  if (args && typeof args.dispatch === 'function') _dispatch = args.dispatch;
}

/**
 * Enfile un job.
 * @param {string} type  - type de job (cf. JOB_TYPES dans le worker).
 * @param {object} payload
 * @param {object} [opts]
 * @param {string} [opts.dedupKey]        - cle de dedup/debounce (ex: `accountId:feedId`).
 * @param {number} [opts.scheduleDelayMs] - delai avant execution (debounce).
 * @param {number} [opts.dedupWindowMs]   - fenetre de dedup (defaut env JOBS_DEDUP_WINDOW_MS).
 * @returns {Promise<{mode:string}>}
 */
async function enqueueJob(type, payload, opts) {
  payload = payload || {};
  opts = opts || {};
  if (!type || typeof type !== 'string') {
    throw new Error('[jobs] enqueueJob: `type` requis');
  }
  const cfg = readConfig();
  const mode = resolveMode(cfg);
  logModeOnce(mode, cfg);

  const dedupWindowMs = opts.dedupWindowMs != null ? opts.dedupWindowMs : cfg.defaultDedupWindowMs;
  const normalized = Object.assign({}, opts, { dedupWindowMs: dedupWindowMs });

  if (mode === 'cloud-tasks') {
    try {
      return await enqueueCloudTask(type, payload, normalized, cfg);
    } catch (err) {
      // Robustesse : si Cloud Tasks echoue (reseau/IAM), on ne perd pas le job —
      // fallback in-process best-effort plutot que de planter l'appelant.
      console.warn('[jobs] createTask echoue (' + type + '), fallback in-process:', (err && err.message) || err);
      return enqueueInProcess(type, payload, normalized, _dispatch);
    }
  }
  return enqueueInProcess(type, payload, normalized, _dispatch);
}

module.exports = {
  enqueueJob: enqueueJob,
  configureJobs: configureJobs,
  resolveMode: resolveMode,
  computeTaskName: computeTaskName,
  computeWindowBucket: computeWindowBucket,
  __readConfig: readConfig,
  __enqueueInProcess: enqueueInProcess,
};
