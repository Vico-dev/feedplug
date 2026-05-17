/**
 * Garde anti-SSRF pour les fetch sortants dont l'URL provient (directement ou
 * indirectement) d'un utilisateur : proxy d'images, génération lifestyle, etc.
 *
 * Politique :
 *  - schéma http/https uniquement ;
 *  - résolution DNS de l'hôte et rejet de toute adresse privée / loopback /
 *    link-local / réservée (bloque notamment le metadata GCP 169.254.169.254) ;
 *  - redirections suivies manuellement, chaque saut étant revalidé.
 */
const dns = require('dns').promises;
const net = require('net');

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // non parsable => considéré comme non sûr
  }
  const [a, b] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // privé
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (inclut metadata cloud)
  if (a === 172 && b >= 16 && b <= 31) return true; // privé
  if (a === 192 && b === 168) return true; // privé
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC 6598)
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 (doc/réservé)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast + réservé
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  const mapped = lower.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // pas une IP reconnue => non sûr
}

/**
 * Valide qu'une URL pointe vers un hôte public joignable en http/https.
 * Lève une erreur explicite sinon. Renvoie l'objet URL parsé.
 */
async function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch {
    throw new Error('URL invalide');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Schéma URL non autorisé');
  }
  const host = parsed.hostname;
  if (!host) {
    throw new Error('URL sans hôte');
  }
  // Hôte fourni sous forme d'IP littérale : contrôle direct.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new Error('Adresse IP non autorisée');
    }
    return parsed;
  }
  // Hôte sous forme de nom : on résout et on rejette si une adresse est interne.
  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Hôte introuvable');
  }
  if (!addresses || addresses.length === 0) {
    throw new Error('Hôte introuvable');
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error('Hôte non autorisé (adresse interne)');
    }
  }
  return parsed;
}

/**
 * fetch() avec garde anti-SSRF : valide l'URL initiale puis chaque redirection.
 * Signature compatible avec fetch (mêmes options), `redirect` est forcé en manuel.
 */
async function safeFetch(rawUrl, options = {}) {
  const { maxRedirects = 5, ...fetchOptions } = options;
  let currentUrl = String(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicHttpUrl(currentUrl);
    const response = await fetch(currentUrl, { ...fetchOptions, redirect: 'manual' });
    const status = response.status;
    const location = response.headers.get('location');
    if (status >= 300 && status < 400 && location) {
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return response;
  }
  throw new Error('Trop de redirections');
}

module.exports = { assertPublicHttpUrl, safeFetch, isPrivateIp };
