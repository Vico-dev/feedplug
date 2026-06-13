'use strict';

// Helpers de redirection post-OAuth pour les surfaces *dashboard* (hors Shopify
// embarqué). Volontairement purs et sans dépendance → testables en isolation.
//
// La normalisation refuse toute URL absolue ou protocol-relative pour éviter les
// open redirects : on n'autorise qu'un chemin relatif same-origin (ex. /channels,
// /fr/channels, /flux). Toute valeur suspecte retombe sur `fallback`.

function normalizeDashboardReturnTo(value, fallback = '/flux') {
  const raw = String(value || '').trim();
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return fallback;
  }
  try {
    const target = new URL(raw, 'https://dashboard.feedplug.local');
    return `${target.pathname}${target.search}`;
  } catch {
    return fallback;
  }
}

// Construit l'URL absolue de redirection (appUrl + returnTo) en y ajoutant des
// query params de statut (?amazon=connected, ?amazon=error&reason=..., etc.).
function buildDashboardRedirectUrl(appUrl, returnTo, params = {}, fallback = '/flux') {
  const path = normalizeDashboardReturnTo(returnTo, fallback);
  const url = new URL(path, appUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

module.exports = { normalizeDashboardReturnTo, buildDashboardRedirectUrl };
