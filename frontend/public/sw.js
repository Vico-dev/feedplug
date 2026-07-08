/*
 * Service Worker — Comparateur Feedplug (PWA B2C)
 *
 * Périmètre : scope "/" mais volontairement INERTE en dehors du comparateur.
 * Il n'est enregistré que depuis (comparateur)/layout.tsx, donc il ne s'installe
 * que pour les visiteurs du comparateur. Même une fois actif sur l'origine, il :
 *   - laisse passer (réseau natif) tout ce qui touche au B2B / API / embed Shopify ;
 *   - sert la navigation en network-first → jamais de HTML périmé sur le dashboard ;
 *   - ne met en cache que l'app shell + les assets immuables (_next/static, icônes).
 *
 * Stratégies :
 *   - navigation  → network-first, fallback offline.html
 *   - _next/static, icônes, images → stale-while-revalidate
 *   - push        → notification (socle Phase 3, alertes baisse de prix)
 */

const VERSION = "feedplug-cmp-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

// Chemins jamais interceptés : on laisse le réseau natif gérer (B2B, API, embed…).
const BYPASS_PREFIXES = [
  "/api",
  "/feedplug-api",
  "/embedded",
  "/dashboard",
  "/_next/data",
  "/_next/image",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("feedplug-cmp-") && !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isBypassed(url) {
  return BYPASS_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
}

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // On ne gère que les GET same-origin ; le reste passe au réseau natif.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;

  // Navigation (pages HTML) → network-first, fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL, { ignoreSearch: true }).then((r) => r || Response.error())
      )
    );
    return;
  }

  // Assets immuables → stale-while-revalidate.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

/* ------------------------------------------------------------------ *
 * Push (socle Phase 3 — alertes baisse de prix). Inerte tant que le
 * backend n'envoie rien ; prêt à recevoir un payload JSON.
 * ------------------------------------------------------------------ */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Feedplug", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Feedplug";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/compte/feed" },
    tag: data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/compte/feed";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
