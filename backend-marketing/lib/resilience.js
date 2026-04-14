/**
 * Résilience : timeouts, retries, dégradation gracieuse.
 * Utilisé pour les appels externes (CSV, Gemini, GCS) pour éviter que la prod reste bloquée.
 */

const DEFAULT_FETCH_TIMEOUT_MS = 60_000;   // 1 min pour un gros CSV
const DEFAULT_OPERATION_TIMEOUT_MS = 30_000;

/**
 * fetch avec timeout (AbortController).
 * @param {string} url
 * @param {{ method?: string; headers?: Record<string,string>; body?: string; timeoutMs?: number }} options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Exécute une Promise avec un timeout. En cas de dépassement, rejette avec une erreur claire.
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms = DEFAULT_OPERATION_TIMEOUT_MS, label = 'Operation') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Retry avec backoff linéaire (1er retry immédiat, puis +1s, +2s...).
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number; delayMs?: number }} options
 * @returns {Promise<T>}
 */
async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 1000;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }
  throw lastErr;
}

/**
 * Exécute fn ; en cas d'erreur, appelle onError et retourne fallback (dégradation gracieuse).
 * @param {() => Promise<T>} fn
 * @param {T} fallback
 * @param {(err: Error) => void} onError
 * @returns {Promise<T>}
 */
async function withFallback(fn, fallback, onError = () => {}) {
  try {
    return await fn();
  } catch (err) {
    onError(err);
    return fallback;
  }
}

module.exports = {
  fetchWithTimeout,
  withTimeout,
  withRetry,
  withFallback,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_OPERATION_TIMEOUT_MS,
};
