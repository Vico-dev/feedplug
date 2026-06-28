import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

const ACCESS_COOKIE = 'fp_access_token';
const REFRESH_COOKIE = 'fp_refresh_token';

// Routes app
const APP_ROUTES = [
  '/login',
  '/register',
  '/onboarding',
  '/choose-plan',
  '/forgot-password',
  '/reset-password',
  '/invitation',
  '/dashboard',
  '/admin',
  '/catalogue',
  '/flux',
  '/markets',
  '/channels',
  '/optimiser',
  '/ia',
  '/rapports',
  '/performance',
  '/scoring-canaux',
  '/notifications',
  '/facturation',
  '/parametres',
  '/sources',
  '/oauth',
  '/embedded',
];

/**
 * Routes destinées à l'iframe Shopify Admin. Auth via session token Shopify
 * (Authorization header) côté API, pas via cookie de session. Doivent autoriser
 * l'embedding dans Shopify Admin via CSP frame-ancestors.
 */
const SHOPIFY_EMBEDDED_PREFIX = '/embedded';

function isEmbeddedRoute(pathname: string) {
  // Routes embedded ne passent pas par [locale], on match donc le prefix brut
  return pathname === SHOPIFY_EMBEDDED_PREFIX || pathname.startsWith(`${SHOPIFY_EMBEDDED_PREFIX}/`);
}

/**
 * Applique les headers d'iframe sur la réponse.
 *  - Routes embedded : autorisent Shopify Admin via CSP frame-ancestors.
 *    On NE PEUT PAS combiner avec X-Frame-Options (qui ne supporte pas
 *    plusieurs origines), donc on l'omet sur ces routes.
 *  - Autres routes : verrouillent contre le clickjacking.
 */
function applyFrameHeaders(response: NextResponse, embedded: boolean) {
  if (embedded) {
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
    );
  } else {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'none';"
    );
  }
  return response;
}

// Routes marketing
const MARKETING_ROUTES_PATTERNS = [
  /^\/$/,
  /^\/(?:fr|en|es)\/?$/,
  /^\/(?:fr|en|es)\/optimiser-flux-(google-shopping|amazon|rakuten|cdiscount)\/?$/,
  /^\/(?:fr|en|es)\/diffusion-nouveaux-canaux\/?$/,
  /^\/optimiser-flux-(google-shopping|amazon|rakuten|cdiscount)\/?$/,
  /^\/diffusion-nouveaux-canaux\/?$/,
];

function stripLocalePrefix(pathname: string) {
  return pathname.replace(/^\/(fr|en|es)(?=\/|$)/, '') || '/';
}

function getLocalePrefix(pathname: string) {
  const match = pathname.match(/^\/(fr|en|es)(?=\/|$)/);
  return match ? `/${match[1]}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Rehoming domaine (conso/B2B) — voir plan rehoming-apex-conso-b2b-pro.md
//   apex feedplug.com  → comparateur conso (rewrite / → /comparateur)
//   pro.feedplug.com   → marketing B2B
//   app.feedplug.com   → dashboard (inchangé)
// Le routing reste piloté par le hostname LITTÉRAL (déterministe) ; la var
// NEXT_PUBLIC_MARKETING_URL ne sert qu'au SEO (canonicals/sitemaps).
// ─────────────────────────────────────────────────────────────────────────────

const PRO_HOST = 'pro.feedplug.com';

/**
 * Chemins « conso » servis sur l'APEX : ils ne doivent JAMAIS être classés
 * marketing ni 301 vers pro. (locale-agnostique — passer pathnameWithoutLocale)
 *  - /comparateur*  : comparateur public + fiches produit
 *  - /compte/*      : espace conso (magic-link, cookie cmp_session, /compte/verifier)
 *  - /legal/*       : pages légales servies côté conso
 */
function isConsumerPath(pathnameWithoutLocale: string) {
  return (
    pathnameWithoutLocale === '/comparateur' ||
    pathnameWithoutLocale.startsWith('/comparateur/') ||
    pathnameWithoutLocale === '/compte' ||
    pathnameWithoutLocale.startsWith('/compte/') ||
    pathnameWithoutLocale === '/legal' ||
    pathnameWithoutLocale.startsWith('/legal/')
  );
}

/**
 * Construit l'URL absolue d'une redirection 301 cross-host feedplug, en
 * préservant path + query et en neutralisant le port interne Cloud Run
 * (sinon le :3000 fuit dans le Location → URL morte).
 */
function buildHostRedirect(request: NextRequest, targetHost: string) {
  const url = new URL(request.url);
  url.protocol = 'https:';
  url.hostname = targetHost;
  url.port = '';
  return url;
}

function isRouteMatch(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isAppPath(pathname: string) {
  const normalizedPathname = stripLocalePrefix(pathname);
  return APP_ROUTES.some((route) => isRouteMatch(normalizedPathname, route));
}

function isLocalDevHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

// next-intl
const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0] || '';
  const port = hostHeader.includes(':') ? hostHeader.split(':')[1] : '';
  const pathname = request.nextUrl.pathname;

  // API/assets — servis tels quels sur tous les hôtes (jamais 301 cross-host).
  // sitemap-comparateur.xml = sitemap conso (apex) ; sitemap.xml = marketing
  // (pro). robots.txt est host-aware côté route handler.
  if (pathname.startsWith('/feedplug-api') || pathname === '/sitemap.xml' || pathname === '/sitemap-comparateur.xml' || pathname === '/robots.txt' || pathname === '/og-image' || pathname === '/logo' || pathname === '/icon' || pathname.startsWith('/icon?')) {
    return NextResponse.next();
  }

  const embedded = isEmbeddedRoute(pathname);

  // Routes embedded Shopify : ni auth cookie, ni i18n routing.
  // L'auth se fait par session token Shopify côté API. La locale est lue par
  // la page elle-même depuis le query param `locale` (envoyé par Shopify Admin).
  if (embedded) {
    return applyFrameHeaders(NextResponse.next(), true);
  }

  // Variante préfixée par la locale (ex: /fr/embedded/channels) : certaines
  // navigations client ajoutent le préfixe locale, ce qui échappe à
  // isEmbeddedRoute et fait tomber la requête dans le gate cookie plus bas →
  // redirect /login DANS l'iframe Shopify (le cookie app.feedplug.com étant
  // tiers, donc non envoyé). On réécrit vers le path embedded canonique
  // (/embedded/..., qui ne vit pas sous [locale]) en préservant les query params.
  const embeddedWithoutLocale = stripLocalePrefix(pathname);
  if (embeddedWithoutLocale !== pathname && isEmbeddedRoute(embeddedWithoutLocale)) {
    const url = request.nextUrl.clone();
    url.pathname = embeddedWithoutLocale;
    return applyFrameHeaders(NextResponse.redirect(url, 307), true);
  }

  // Shopify Admin charge parfois l'app sur un path autre que /embedded en
  // injectant ses query params (host base64 + shop myshopify.com). C'est le
  // cas notamment après approbation Managed Pricing (Shopify redirige vers
  // {app}/dashboard?host=...&shop=...). Sans CSP frame-ancestors permissif,
  // le browser bloque l'iframe avec "n'autorise pas la connexion". On
  // redirige donc systématiquement vers /embedded en préservant les params.
  const hostParam = request.nextUrl.searchParams.get('host');
  const shopParam = request.nextUrl.searchParams.get('shop');
  const isShopifyAdminContext =
    Boolean(hostParam) &&
    Boolean(shopParam) &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopParam || '');
  if (isShopifyAdminContext) {
    const url = request.nextUrl.clone();
    url.pathname = '/embedded';
    return applyFrameHeaders(NextResponse.redirect(url, 302), true);
  }

  // Canonicalisation www
  if (hostname === 'www.feedplug.com') {
    const url = new URL(request.url);
    url.hostname = 'feedplug.com';
    url.port = ''; // sinon le :3000 interne Cloud Run fuit dans le Location → URL morte
    return NextResponse.redirect(url, 301);
  }

  // HTTPS canonique sur host app
  const isAppHost = hostname === 'app.feedplug.com' || hostname.endsWith('.run.app');
  if (isAppHost && port === '3000') {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  // ── Classification des hôtes ──────────────────────────────────────────────
  const isLocalHost = isLocalDevHost(hostname);

  // Apex conso : feedplug.com (+ www déjà canonicalisé plus haut). En local,
  // l'apex sert TOUT (conso + marketing + app) pour le dev — comportement
  // historique conservé.
  const isApexDomain =
    hostname === 'feedplug.com' ||
    hostname === 'www.feedplug.com' ||
    isLocalHost;

  // pro.feedplug.com : marketing B2B (4ᵉ mapping Cloud Run, même service).
  const isProDomain = hostname === PRO_HOST;

  // « Domaine marketing » au sens des branches historiques (sert les pages
  // marketing via intlMiddleware). Désormais : pro. + apex (l'apex sert encore
  // le marketing en local ; en prod les routes marketing y sont 301 vers pro).
  const isMarketingDomain = isProDomain || isApexDomain;

  // Domaine app (inchangé)
  const isAppDomain =
    hostname === 'app.feedplug.com' ||
    (typeof hostname === 'string' && hostname.endsWith('.run.app')) ||
    isLocalHost;
  const isHostedAppDomain =
    hostname === 'app.feedplug.com' ||
    (typeof hostname === 'string' && hostname.endsWith('.run.app'));

  const pathnameWithoutLocale = stripLocalePrefix(pathname);
  const localePrefix = getLocalePrefix(pathname);
  const isAppRoute = isAppPath(pathname);
  const isConsumerRoute = isConsumerPath(pathnameWithoutLocale);

  const isMarketingRoute =
    MARKETING_ROUTES_PATTERNS.some(pattern => pattern.test(pathname)) ||
    (!isAppRoute && !pathname.startsWith('/api') && !pathname.startsWith('/_next'));

  // ── Rehoming : routage spécifique apex / pro ──────────────────────────────
  // Placé APRÈS la classification mais AVANT les branches app historiques pour
  // que les 301 cross-host priment sur le rendu local. En local (isLocalHost),
  // on saute tout ce bloc → l'apex local sert tout comme avant.
  if (!isLocalHost && isApexDomain) {
    // 1) Home apex → comparateur (REWRITE interne : l'URL /, /en, /es reste
    //    affichée, mais on rend la page comparateur). On préserve la query
    //    (?q=, ?country=, …) via le clone de nextUrl.
    if (pathnameWithoutLocale === '/' && !isAppRoute) {
      const url = request.nextUrl.clone();
      // Les routes vivent sous app/[locale]/… : le rewrite DOIT porter le segment
      // de locale explicite (même pour le FR par défaut, non préfixé côté URL),
      // sinon Next ne résout pas la route et renvoie 404. L'URL affichée reste / (rewrite).
      const locale = localePrefix ? localePrefix.slice(1) : 'fr';
      url.pathname = `/${locale}/comparateur`;
      return applyFrameHeaders(NextResponse.rewrite(url), false);
    }

    // 2) /comparateur (racine seule, toute locale) → 301 vers la home / (la
    //    home conso EST le comparateur, servi en rewrite). On ne touche PAS
    //    /comparateur/produit/* ni les pages sous /comparateur/<x>.
    if (pathnameWithoutLocale === '/comparateur') {
      const url = buildHostRedirect(request, 'feedplug.com');
      url.pathname = localePrefix || '/';
      return NextResponse.redirect(url, 301);
    }

    // 3) Routes conso (/comparateur/*, /compte/*, /legal/*) : servies sur
    //    l'apex via intlMiddleware. JAMAIS 301 vers pro.
    if (isConsumerRoute) {
      return applyFrameHeaders(intlMiddleware(request), false);
    }

    // 4) Routes app accédées sur l'apex → 302 vers app. (comportement existant,
    //    géré par la branche `isMarketingDomain && isAppRoute` plus bas — on
    //    laisse filer).

    // 5) Routes marketing (LP SEO, /tarifs, /docs, /integrations, /audit-flux,
    //    /demo, /feedplug-vs-*, …) → 301 permanent URL-à-URL vers pro.
    //    On exclut les routes app (gérées plus bas) et les routes conso (déjà
    //    traitées au point 3).
    if (!isAppRoute && isMarketingRoute) {
      const url = buildHostRedirect(request, PRO_HOST);
      return NextResponse.redirect(url, 301);
    }
  }

  if (!isLocalHost && isProDomain) {
    // 1) Routes conso atterrissant sur pro → 301 vers l'apex (le comparateur
    //    vit sur feedplug.com). Inclut /comparateur, /comparateur/*, /compte/*,
    //    /legal/*. La home conso est l'apex / : on y renvoie /comparateur racine.
    if (isConsumerRoute) {
      const url = buildHostRedirect(request, 'feedplug.com');
      if (pathnameWithoutLocale === '/comparateur') {
        url.pathname = localePrefix || '/';
      }
      return NextResponse.redirect(url, 301);
    }

    // 2) Routes app atterrissant sur pro → 302 vers app. (géré par la branche
    //    `isMarketingDomain && isAppRoute` plus bas — on laisse filer).

    // 3) Tout le reste sur pro = marketing → servi via intlMiddleware par la
    //    branche `isMarketingDomain` plus bas.
  }

  if (isHostedAppDomain && pathnameWithoutLocale === '/') {
    const hasAuthCookie =
      Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
      Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}${hasAuthCookie ? '/dashboard' : '/login'}`;
    return NextResponse.redirect(url, 307);
  }
  
  if (isAppDomain && isAppRoute) {
    const isAppAuthRouteWithoutLocale =
      pathnameWithoutLocale === '/login' ||
      pathnameWithoutLocale === '/register' ||
      pathnameWithoutLocale === '/forgot-password' ||
      pathnameWithoutLocale === '/reset-password' ||
      pathnameWithoutLocale === '/invitation' ||
      pathnameWithoutLocale === '/choose-plan' ||
      pathnameWithoutLocale === '/onboarding' ||
      pathnameWithoutLocale.startsWith('/oauth/');

    if (isAppAuthRouteWithoutLocale) {
      // Les pages auth (login/register/onboarding/…) vivent sous app/ HORS du
      // segment [locale], mais relisent la locale depuis usePathname() pour
      // construire leurs liens (/en/dashboard, …). Une URL préfixée comme
      // /en/login n'a donc AUCUNE route physique → 404. On REWRITE (l'URL
      // visible reste /en/login, la page reste localisée) vers le path non
      // préfixé pour servir app/login/page.tsx. Sans préfixe (fr), next() suffit.
      if (localePrefix) {
        const url = request.nextUrl.clone();
        url.pathname = pathnameWithoutLocale;
        return applyFrameHeaders(NextResponse.rewrite(url), false);
      }
      return applyFrameHeaders(NextResponse.next(), false);
    }

    // Gate auth côté serveur sur les routes protégées : sans cookie de session,
    // on redirige vers /login avant de servir la page (évite l'affichage fugace
    // d'une page protégée tant que le contrôle JS n'a pas tourné). La validation
    // réelle du token reste faite par le backend sur chaque appel API.
    const hasAuthCookie =
      Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
      Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
    if (!hasAuthCookie) {
      const url = request.nextUrl.clone();
      url.pathname = `${localePrefix}/login`;
      return NextResponse.redirect(url, 307);
    }

    return applyFrameHeaders(intlMiddleware(request), false);
  }

  if (!isLocalHost && isMarketingDomain && isAppRoute) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'app.feedplug.com';
    url.port = ''; // port par défaut HTTPS (443)
    url.pathname = pathnameWithoutLocale;
    // 302 (temporaire) et non 301 : ces redirections dépendent de la
    // classification app/marketing (APP_ROUTES / MARKETING_ROUTES_PATTERNS).
    // Un 301 serait mis en cache de façon permanente par les navigateurs ; si
    // une route est mal classée (bug), la mauvaise redirection « colle » dans
    // les caches même après correctif. Le 302 évite ce piège.
    return NextResponse.redirect(url, 302);
  }

  if (!isLocalHost && isAppDomain && isMarketingRoute) {
    // Marketing/conso atterrissant sur app. → on renvoie vers le bon hôte :
    //  - routes conso (/comparateur*, /compte/*, /legal/*) → apex feedplug.com
    //  - autres routes marketing (LP SEO, /tarifs, /docs, …)  → pro.feedplug.com
    // 302 (temporaire) : redirection dépendante de la classification de route,
    // ne doit pas être mise en cache de façon permanente (cf. note ci-dessus).
    const targetHost = isConsumerRoute ? 'feedplug.com' : PRO_HOST;
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = targetHost;
    url.port = '';
    return NextResponse.redirect(url, 302);
  }
  
  // Docs
  const isDocsRoute = pathname === '/docs' || pathname.startsWith('/docs/');
  if (isMarketingDomain && isDocsRoute) {
    return applyFrameHeaders(NextResponse.next(), false);
  }

  if (isMarketingDomain) {
    return applyFrameHeaders(intlMiddleware(request), false);
  }

  if (isAppDomain) {
    return applyFrameHeaders(intlMiddleware(request), false);
  }

  return applyFrameHeaders(NextResponse.next(), false);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          
